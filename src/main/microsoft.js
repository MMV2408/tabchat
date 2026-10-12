// Everything around signing in to Microsoft (Teams, Outlook, OneDrive):
// - one shared sign-in
// - tabs sign in one after another (otherwise double two-step verification)
// - staying signed in after quitting
const { dialog } = require('electron');
const store = require('./store');
const config = require('./config');
const { CATALOG, isMsAppHost, urlFor, isOwnHost, hostOf } = require('./catalog');
const log = require('./log');
// The service itself (Microsoft, or e.g. your school's Brightspace) and not a sign-in page
const isAppHost = (tab, host) => isMsAppHost(host) || isOwnHost(tab, host);
const views = require('./views');
const { t } = require('./i18n');

// ---------- which storage (login) a tab uses ----------
// With "One Microsoft account", Teams, Outlook and OneDrive share the same storage.
// Second accounts (e.g. "outlook-2") share with "onedrive-2" etc.
// A duplicated tab has `login`: the id of the tab whose login it shares.
function partitionFor(tab) {
  const id = tab.login || tab.id;
  if (tab.temp) return 'temp-' + id; // incognito: in memory only, gone after closing
  const group = CATALOG[tab.service].group;
  if (group && store.config.settings.shareMicrosoft) {
    const suffix = id.slice(tab.service.length); // '' or '-2'
    return 'persist:' + group + suffix;
  }
  return 'persist:' + id;
}

// ---------- signing in one after another ----------
// The first tab loads right away; the rest waits until that tab is signed in.
const msReady = new Set(); // logins (partitions) already signed in this session
const waiting = new Set(); // tabs still waiting to load

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
  // wait 2 seconds so Microsoft has stored all login cookies
  setTimeout(() => {
    for (const t of store.config.tabs) {
      if (t.id === tab.id || partitionFor(t) !== part || !store.views[t.id]) continue;
      if (waiting.has(t.id)) { loadTab(t.id); continue; }
      // Is the other tab still on a sign-in page? Then reload it.
      const host = hostOf(store.views[t.id].webContents.getURL());
      if (host && !isAppHost(t, host)) loadTab(t.id);
    }
  }, 2000);
}

// Notice when a tab goes from the sign-in page back to the service
function watchLogin(tab, view) {
  let onLogin = false;
  view.webContents.on('did-navigate', (_e, url) => {
    const host = hostOf(url);
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

// ---------- staying signed in ----------
// Microsoft and school accounts use "session cookies" that disappear when you close the app.
// Here we make those cookies valid for 14 days, just like "Stay signed in".
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
    ses.cookies.set(details).catch(e => log.warn('keep login cookie:', cookie.name, e.message));
  });
}

// ---------- one-time explanation on the first Microsoft tab ----------
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
