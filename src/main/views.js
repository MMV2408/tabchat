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

const BAR = 44; // hoogte tabbalk in pixels

// ---------- status naar de schermen ----------
function labelFor(tab) {
  const same = store.config.tabs.filter(t => t.service === tab.service);
  const name = CATALOG[tab.service].name;
  return same.length > 1 ? `${name} ${same.indexOf(tab) + 1}` : name;
}

function getState() {
  const { config, views, active, mutedTabs, closedTabs } = store;
  return {
    active,
    activeIsTab: !!views[active],
    activeMuted: mutedTabs.has(active),
    canReopen: closedTabs.length > 0,
    tabs: config.tabs.map(t => ({
      id: t.id,
      service: t.service,
      label: labelFor(t),
      color: CATALOG[t.service].color,
      muted: mutedTabs.has(t.id),
      unread: unread.get(t.id), // aantal, 'dot' of 0
      asleep: sleep.isAsleep(t.id),
      canSleep: sleep.canSleep(t)
    })),
    dnd: { on: dnd.isOn(), label: dnd.label() },
    catalog: Object.entries(CATALOG).map(([id, s]) => ({ id, name: s.name, key: s.key, color: s.color, desc: s.desc })),
    settings: config.settings
  };
}

function broadcast() {
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
    // Zoom terugzetten na het laden van een pagina
    const t = store.config.tabs.find(x => x.id === tab.id);
    if (t && t.zoom) v.webContents.setZoomFactor(t.zoom);
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

  // Inlogvensters in de app, andere links in de gewone browser
  v.webContents.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (LOGIN_HOSTS.includes(host)) return { action: 'allow' };
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
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

// ---------- tonen ----------
function layout() {
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
  layout();
  broadcast();
  if (!store.paletteOpen && !store.shareOpen) focusActive();
}

Object.assign(module.exports, {
  getState, broadcast, createServiceView, destroyView, removeForSleep, layout, focusActive, show
});
