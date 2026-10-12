// De schermen in het venster: tabbladen maken, tonen, verbergen en de status
// doorsturen naar de tabbalk en het +-scherm.
const { WebContentsView, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { UA, CATALOG, LOGIN_HOSTS } = require('./catalog');
const microsoft = require('./microsoft');
const shortcuts = require('./shortcuts');
const palette = require('./palette');
const unread = require('./unread');
const dnd = require('./dnd');
const sleep = require('./sleep');
const i18n = require('./i18n');

const BAR = 44; // hoogte tabbalk in pixels
const ERROR_PAGE = path.join(__dirname, '..', 'renderer', 'error.html');

// ---------- status naar de schermen ----------
function labelFor(tab) {
  const same = store.config.tabs.filter(t => t.service === tab.service);
  const name = CATALOG[tab.service].name;
  return same.length > 1 ? `${name} ${same.indexOf(tab) + 1}` : name;
}

// Labeltje "School/werk" of "Privé" bij Microsoft-tabbladen, alleen als je ze allebei hebt
function accountOf(tab) {
  const g = CATALOG[tab.service].group;
  return g === 'microsoft' ? 'work' : g === 'microsoft-personal' ? 'personal' : '';
}
function accountTag(tab) {
  const kinds = new Set(store.config.tabs.map(accountOf));
  return kinds.has('work') && kinds.has('personal') ? accountOf(tab) : '';
}

function getState() {
  const { config, views, active, mutedTabs, closedTabs } = store;
  return {
    lang: i18n.lang(),
    active,
    activeIsTab: !!views[active],
    activeMuted: mutedTabs.has(active),
    canReopen: closedTabs.length > 0,
    tabs: config.tabs.map(t => ({
      id: t.id,
      service: t.service,
      label: labelFor(t),
      tag: accountTag(t), // '', 'work' of 'personal'
      fullLabel: labelFor(t) + (accountTag(t) ? ` (${i18n.t('acct.' + accountTag(t))})` : ''),
      color: CATALOG[t.service].color,
      muted: mutedTabs.has(t.id),
      unread: unread.get(t.id), // aantal, 'dot' of 0
      asleep: sleep.isAsleep(t.id),
      canSleep: sleep.canSleep(t)
    })),
    dnd: { on: dnd.isOn(), manual: dnd.isManual(), label: dnd.label() },
    browsers: require('./links').browsers().map(b => ({ id: b.id, name: b.name })),
    platform: { kind: require('./platform').kind, storeManaged: require('./platform').storeManaged },
    update: require('./updater').getStatus(),
    catalog: Object.entries(CATALOG).map(([id, s]) => ({ id, name: s.name, key: s.key, color: s.color, base: s.base || null, desc: i18n.t('svc.' + (s.base || id)) })),
    settings: config.settings
  };
}

function broadcast() {
  if (!store.alive()) return;
  const s = getState();
  store.bar.webContents.send('state', s);
  store.home.webContents.send('state', s);
  require('./tray').refresh(); // tabbladen in het tray-menu bijwerken
}

// ---------- tabblad maken ----------
function createServiceView(tab) {
  const v = new WebContentsView({
    webPreferences: {
      partition: microsoft.partitionFor(tab),
      preload: path.join(__dirname, '..', 'preload', 'service.js'),
      spellcheck: store.config.settings.spellcheck,
      zoomFactor: tab.zoom || 1
    }
  });
  const ses = v.webContents.session;
  ses.setSpellCheckerLanguages(['nl', 'en-US']);
  v.webContents.setUserAgent(UA);
  v.webContents.on('before-input-event', shortcuts.handler('tab'));
  unread.watch(tab, v);

  v.webContents.on('did-finish-load', () => {
    const url = v.webContents.getURL();
    if (url.startsWith('file:')) {
      v.webContents.setZoomFactor(1); // foutscherm altijd op normale grootte
    } else {
      // Zoom terugzetten na het laden van een pagina
      const t = store.config.tabs.find(x => x.id === tab.id);
      if (t && t.zoom) v.webContents.setZoomFactor(t.zoom);
      checkRawPage(tab, v);
    }
    // Na herladen (F5) de focus terugzetten op het actieve tabblad
    if (tab.id === store.active && store.win.isFocused()) focusActive();
  });

  // Een verborgen tabblad (bv. Outlook dat op de achtergrond laadt) kan de focus
  // "stelen". Dan werken de sneltoetsen niet meer. Zet de focus dan direct terug.
  v.webContents.on('focus', () => {
    if (tab.id !== store.active || store.paletteOpen || store.shareOpen) setImmediate(focusActive);
  });

  if (CATALOG[tab.service].group) {
    microsoft.keepLogin(ses, microsoft.partitionFor(tab));
    microsoft.watchLogin(tab, v);
  }

  // Inlogvensters in de app; andere links volgens "Links openen in" (zie links.js)
  const links = require('./links');
  v.webContents.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (LOGIN_HOSTS.includes(host)) return { action: 'allow' };
    if (/^https?:/.test(url)) { links.open(url, ses); return { action: 'deny' }; }
    // Leeg venster (Outlook doet dat): verborgen openen en het adres opvangen
    if (!url || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
    return { action: 'deny' };
  });
  v.webContents.on('did-create-window', (child, { url }) => {
    if (!url || url === 'about:blank') links.catchBlank(child, ses);
  });

  // Foutscherm als de dienst niet laadt (geen internet, storing) of vastloopt
  v.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file:')) return; // -3 = afgebroken, geen echte fout
    showError(tab, v, { code, desc, url: /^https?:/.test(url) ? url : CATALOG[tab.service].url });
  });
  v.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || store.views[tab.id] !== v) return; // zelf gesloten (bv. slaapstand)
    showError(tab, v, { reason: 'crash' });
  });

  // Scherm delen: keuzevenster tonen (zie share.js)
  ses.setDisplayMediaRequestHandler((_request, callback) => require('./share').request(callback));

  // Wachten als een ander Microsoft-tabblad met dezelfde login al bezig is
  if (microsoft.shouldWait(tab)) microsoft.waiting.add(tab.id);
  else v.webContents.loadURL(CATALOG[tab.service].url);

  v.setVisible(false);
  store.win.contentView.addChildView(v);
  store.views[tab.id] = v;
  dnd.applyToView(tab.id, v); // geluid uit bij Niet storen
  if (store.paletteOpen) palette.bringToFront();
}

function destroyView(id) {
  sleep.forget(id);
  const v = store.views[id];
  if (!v) return;
  microsoft.waiting.delete(id);
  store.mutedTabs.delete(id);
  unread.forget(id);
  store.win.contentView.removeChildView(v);
  v.webContents.close();
  delete store.views[id];
}

// Uit het geheugen halen voor de slaapstand (tabblad blijft in de balk staan)
function removeForSleep(id) {
  const v = store.views[id];
  if (!v) return;
  store.win.contentView.removeChildView(v);
  v.webContents.close();
  delete store.views[id];
  unread.forget(id); // een slapend tabblad kan niet tellen
}

// ---------- foutscherm ----------
function showError(tab, v, info) {
  if (v.webContents.isDestroyed()) return;
  const svc = CATALOG[tab.service];
  v.webContents.loadFile(ERROR_PAGE, {
    query: {
      name: svc.name,
      color: svc.color,
      url: info.url || svc.url,
      code: String(info.code || ''),
      desc: info.desc || '',
      reason: info.reason || '',
      lang: i18n.lang()
    }
  });
}

// Sommige diensten (bv. Outlook) tonen zonder internet hun eigen offline-pagina
// als ruwe code. Die pagina "laadt" wel, dus did-fail-load merkt niets.
// Herkennen we zo'n pagina, dan tonen we ons eigen foutscherm.
function checkRawPage(tab, v) {
  v.webContents.executeJavaScript(
    "document.contentType === 'text/plain' && /^\\s*<(!doctype|html)/i.test((document.body && document.body.innerText) || '')"
  ).then(isRaw => {
    if (isRaw) showError(tab, v, { code: -106, desc: 'OFFLINE_PAGE', url: CATALOG[tab.service].url });
  }).catch(() => {});
}

// Herladen. Staat er een foutscherm? Dan de dienst opnieuw proberen.
function reloadView(id) {
  const v = store.views[id];
  if (!v) return;
  if (v.webContents.getURL().startsWith('file:')) {
    const tab = store.config.tabs.find(t => t.id === id);
    if (tab) v.webContents.loadURL(CATALOG[tab.service].url);
  } else {
    v.webContents.reload();
  }
}

// ---------- tonen ----------
function layout() {
  if (!store.alive()) return;
  const { win, bar, home, palette: pal, views, active, paletteOpen } = store;
  const { width, height } = win.getContentBounds();
  const area = { x: 0, y: BAR, width, height: height - BAR };
  bar.setBounds({ x: 0, y: 0, width, height: BAR });
  home.setBounds(area);
  home.setVisible(active === 'home');
  for (const [id, v] of Object.entries(views)) {
    v.setBounds(area);
    v.setVisible(id === active);
  }
  pal.setBounds({ x: 0, y: 0, width, height });
  pal.setVisible(paletteOpen);
  store.share.setBounds({ x: 0, y: 0, width, height });
  store.share.setVisible(store.shareOpen);
}

// Toetsenbord naar het juiste scherm, zodat de sneltoetsen altijd werken
function focusActive() {
  if (store.shareOpen) return store.share.webContents.focus();
  if (store.paletteOpen) return store.palette.webContents.focus();
  const target = store.active === 'home' ? store.home : store.views[store.active];
  (target || store.bar).webContents.focus();
}

function show(id) {
  if (sleep.isAsleep(id)) sleep.wake(id); // slapend tabblad: weer laden
  if (microsoft.waiting.has(id)) microsoft.loadTab(id); // zelf geopend: dan toch laden
  sleep.seen(store.active); // vorige tabblad: net nog bekeken
  sleep.seen(id);
  store.active = id;
  if (id !== 'home') store.lastTab = id;
  require('./theme').flush(id); // tabbladen met een nieuw thema herladen zodra je wegklikt
  layout();
  broadcast();
  if (!store.paletteOpen && !store.shareOpen) focusActive();
}

Object.assign(module.exports, {
  getState, broadcast, createServiceView, destroyView, removeForSleep, reloadView, layout, focusActive, show
});
