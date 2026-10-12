// Alles rond inloggen bij Microsoft (Teams, Outlook, OneDrive):
// - één gedeelde login
// - tabbladen na elkaar laten inloggen (anders dubbele tweestapsverificatie)
// - ingelogd blijven na afsluiten
const { dialog } = require('electron');
const store = require('./store');
const config = require('./config');
const { CATALOG, isMsAppHost, urlFor, isOwnHost } = require('./catalog');
// De dienst zelf (Microsoft, of bv. de Brightspace van je school) en geen inlogscherm
const isAppHost = (tab, host) => isMsAppHost(host) || isOwnHost(tab, host);
const views = require('./views');
const { t } = require('./i18n');

// ---------- welke opslag (login) een tabblad gebruikt ----------
// Met "Eén Microsoft-account" delen Teams, Outlook en OneDrive dezelfde opslag.
// Tweede accounts (bv. "outlook-2") delen met "onedrive-2" enz.
function partitionFor(tab) {
  const group = CATALOG[tab.service].group;
  if (group && store.config.settings.shareMicrosoft) {
    const suffix = tab.id.slice(tab.service.length); // '' of '-2'
    return 'persist:' + group + suffix;
  }
  return 'persist:' + tab.id;
}

// ---------- na elkaar inloggen ----------
// Het eerste tabblad laadt direct; de rest wacht tot dat tabblad ingelogd is.
const msReady = new Set(); // logins (partities) die deze sessie al ingelogd zijn
const waiting = new Set(); // tabbladen die nog wachten met laden

function shouldWait(tab) {
  const part = partitionFor(tab);
  return !!CATALOG[tab.service].group && store.config.settings.shareMicrosoft && !msReady.has(part) &&
    store.config.tabs.some(t => t.id !== tab.id && store.views[t.id] && partitionFor(t) === part);
}

function loadTab(id) {
  const tab = store.config.tabs.find(t => t.id === id);
  if (!tab || !store.views[id]) return;
  waiting.delete(id);
  store.views[id].webContents.loadURL(urlFor(tab));
}

function onLoggedIn(tab) {
  const part = partitionFor(tab);
  // 2 seconden wachten zodat Microsoft alle login-cookies heeft opgeslagen
  setTimeout(() => {
    for (const t of store.config.tabs) {
      if (t.id === tab.id || partitionFor(t) !== part || !store.views[t.id]) continue;
      if (waiting.has(t.id)) { loadTab(t.id); continue; }
      // Staat het andere tabblad nog op een inlogscherm? Dan opnieuw laden.
      let host = '';
      try { host = new URL(store.views[t.id].webContents.getURL()).hostname; } catch {}
      if (host && !isAppHost(t, host)) loadTab(t.id);
    }
  }, 2000);
}

// Merken wanneer een tabblad van het inlogscherm terug naar de dienst gaat
function watchLogin(tab, view) {
  let onLogin = false;
  view.webContents.on('did-navigate', (_e, url) => {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (!host) return;
    const part = partitionFor(tab);
    if (!isAppHost(tab, host)) {
      onLogin = true;
    } else if (onLogin || !msReady.has(part)) {
      onLogin = false;
      msReady.add(part);
      if (store.config.settings.shareMicrosoft) onLoggedIn(tab);
    }
  });
}

// ---------- ingelogd blijven ----------
// Microsoft en schoolaccounts gebruiken "sessie-cookies" die verdwijnen als je de app
// sluit. Hier maken we die cookies 14 dagen geldig, net als "Aangemeld blijven".
const keptSessions = new Set();
function keepLogin(ses, part) {
  if (keptSessions.has(part)) return;
  keptSessions.add(part);
  ses.cookies.on('changed', (_e, cookie, _cause, removed) => {
    if (removed || !cookie.session || !store.config.settings.stayLoggedIn) return;
    const host = cookie.domain.replace(/^\./, '');
    const details = {
      url: (cookie.secure ? 'https://' : 'http://') + host + (cookie.path || '/'),
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: Date.now() / 1000 + 14 * 24 * 3600
    };
    if (!cookie.hostOnly) details.domain = cookie.domain;
    ses.cookies.set(details).catch(() => {});
  });
}

// ---------- eenmalige uitleg bij het eerste Microsoft-tabblad ----------
async function showLoginNotice() {
  const { response } = await dialog.showMessageBox(store.win, {
    type: 'info',
    title: t('ms.title'),
    message: t('ms.message'),
    detail: t('ms.detail'),
    buttons: [t('ms.yes'), t('ms.no')],
    defaultId: 0,
    cancelId: 1
  });
  store.config.settings.stayLoggedIn = response === 0;
  store.config.loginNoticeShown = true;
  config.save();
  views.broadcast();
}

Object.assign(module.exports, {
  partitionFor, waiting, shouldWait, loadTab, watchLogin, keepLogin, keptSessions, showLoginNotice
});
