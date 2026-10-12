// Alles wat je met tabbladen en de app kunt doen.
// Wordt gebruikt door sneltoetsen, Ctrl+K, het rechtsklikmenu en de schermen.
const { app, session } = require('electron');
const store = require('./store');
const config = require('./config');
const { CATALOG, urlFor } = require('./catalog');
const views = require('./views');
const microsoft = require('./microsoft');

// ---------- tabbladen toevoegen en weghalen ----------
// Eerste keer "whatsapp", tweede keer "whatsapp-2" enz. (eigen login per tabblad)
function nextId(service) {
  let id = service;
  let n = 2;
  while (store.config.tabs.some(t => t.id === id)) id = `${service}-${n++}`;
  return id;
}

function addTab(service, url, opts = {}) {
  if (!CATALOG[service]) return;
  const tab = { id: nextId(service), service };
  if (opts.temp) tab.temp = true;
  const svc = CATALOG[service];
  if (svc.askUrl) {
    // Adres verschilt per school: het adres uit de instellingen, anders eerst vragen
    const { normalizeUrl } = require('./catalog');
    const given = normalizeUrl(url);
    const saved = svc.settingUrl ? normalizeUrl(store.config.settings[svc.settingUrl]) : null;
    if (!given && !saved) {
      views.show('home');
      views.whenReady('home', (h) => h.webContents.send('ask-url', service));
      return;
    }
    // Ingevuld en nog niets bewaard? Dan onthouden voor de volgende keer
    if (given && svc.settingUrl && !saved) store.config.settings[svc.settingUrl] = given;
    else if (given && given !== saved) tab.url = given;
  }
  store.config.tabs.push(tab);
  config.save();
  views.createServiceView(tab);
  views.show(tab.id);
  if (CATALOG[service].group && !store.config.loginNoticeShown) microsoft.showLoginNotice();
}

// ---------- eigen websites (zie custom.js) ----------
function addCustom(data, temp) {
  const custom = require('./custom');
  const c = custom.clean(data);
  if (!c) return;
  if (temp) {
    // Incognito: alleen dit ene tabblad, niets bewaren
    const id = custom.newId('temp');
    custom.register({ id, ...c, school: false, temp: true });
    return addTab(id, null, { temp: true });
  }
  const id = custom.newId('custom');
  store.config.custom.push({ id, ...c });
  custom.register({ id, ...c });
  config.save();
  addTab(id);
}

function updateCustom(id, data) {
  const custom = require('./custom');
  const entry = store.config.custom.find(x => x.id === id);
  const c = custom.clean(data);
  if (!entry || !c) return;
  const urlChanged = entry.url !== c.url;
  const schoolChanged = !!entry.school !== c.school;
  Object.assign(entry, c);
  custom.register(entry);
  config.save();
  for (const tab of store.config.tabs) {
    if (tab.service !== id || !store.views[tab.id]) continue;
    if (schoolChanged) { views.destroyView(tab.id); views.createServiceView(tab); } // andere login
    else if (urlChanged) store.views[tab.id].webContents.loadURL(c.url);
  }
  views.layout();
  views.broadcast();
}

async function removeCustom(id) {
  for (const tab of store.config.tabs.filter(t => t.service === id)) await removeTab(tab.id);
  store.config.custom = store.config.custom.filter(x => x.id !== id);
  store.config.settings.cardOrder = (store.config.settings.cardOrder || []).filter(x => x !== id);
  require('./custom').unregister(id);
  config.save();
  views.broadcast();
}

// Incognito-tabblad dicht: dienst en tijdelijke opslag opruimen
function forgetTemp(tab) {
  if (!tab.temp) return;
  if (store.config.tabs.some(t => t.service === tab.service)) return;
  require('./custom').unregister(tab.service);
  session.fromPartition(microsoft.partitionFor(tab)).clearStorageData().catch(() => {});
}

// Sluiten: tabblad weg, maar login blijft bewaard (dus snel weer toe te voegen)
function closeTab(id = store.active) {
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const closing = tabs[i];
  if (!closing.temp) store.closedTabs.push({ tab: { ...closing }, index: i }); // incognito komt niet terug
  tabs.splice(i, 1);
  config.save();
  views.destroyView(id);
  forgetTemp(closing);
  if (store.lastTab === id) store.lastTab = null;
  if (store.active === id) {
    const next = tabs[i] || tabs[i - 1];
    views.show(next ? next.id : 'home');
  } else {
    views.broadcast();
  }
}

function reopenTab() {
  const closed = store.closedTabs.pop();
  if (!closed) return;
  const tab = closed.tab;
  if (store.config.tabs.some(t => t.id === tab.id)) tab.id = nextId(tab.service);
  store.config.tabs.splice(Math.min(closed.index, store.config.tabs.length), 0, tab);
  config.save();
  views.createServiceView(tab);
  views.show(tab.id);
}

// Verwijderen (in het +-scherm): tabblad weg én uitloggen
async function removeTab(id) {
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const part = microsoft.partitionFor(tabs[i]);
  const removed = tabs[i];
  tabs.splice(i, 1);
  config.save();
  views.destroyView(id);
  forgetTemp(removed);
  if (store.lastTab === id) store.lastTab = null;
  // Login wissen, tenzij een ander tabblad dezelfde login gebruikt
  if (!tabs.some(t => microsoft.partitionFor(t) === part)) {
    await session.fromPartition(part).clearStorageData();
  }
  if (store.active === id) store.active = 'home';
  views.show(store.active);
}

// ---------- volgorde ----------
function moveTab(id, dir) {
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= tabs.length) return;
  [tabs[i], tabs[j]] = [tabs[j], tabs[i]];
  config.save();
  views.broadcast();
}

// Slepen: tabblad naar een nieuwe plek (index) verplaatsen
function reorderTab(id, to) {
  const tabs = store.config.tabs;
  const from = tabs.findIndex(t => t.id === id);
  if (from < 0 || typeof to !== 'number') return;
  if (from < to) to--; // na het weghalen schuift alles één plek op
  to = Math.max(0, Math.min(to, tabs.length - 1));
  if (from === to) return;
  const [tab] = tabs.splice(from, 1);
  tabs.splice(to, 0, tab);
  config.save();
  views.broadcast();
}

function cycle(dir) {
  const ids = store.config.tabs.map(t => t.id);
  if (!ids.length) return;
  const i = ids.indexOf(store.active);
  const next = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length;
  views.show(ids[next]);
}

function goToIndex(i) {
  const tabs = store.config.tabs;
  if (i === -1) i = tabs.length - 1; // -1 = laatste tabblad
  if (tabs[i]) views.show(tabs[i].id);
}

// ---------- binnen een tabblad ----------
function reload(id = store.active) {
  views.reloadView(id);
}

// Alle tabbladen herladen (voor als een dienst vastloopt).
// Tabbladen die nog wachten op een Microsoft-login slaan we over.
function reloadAll() {
  const waiting = require('./microsoft').waiting;
  for (const [id, v] of Object.entries(store.views)) {
    if (!waiting.has(id)) views.reloadView(id);
  }
}

function toggleMute(id = store.active) {
  const v = store.views[id];
  if (!v) return;
  const muted = !store.mutedTabs.has(id);
  v.webContents.setAudioMuted(muted || require('./dnd').isOn());
  if (muted) store.mutedTabs.add(id); else store.mutedTabs.delete(id);
  views.broadcast();
}

function zoom(delta, id = store.active) {
  const tab = store.config.tabs.find(t => t.id === id);
  if (!tab || !store.views[id]) return;
  const z = delta === 0 ? 1 : Math.min(2, Math.max(0.5, Math.round(((tab.zoom || 1) + delta) * 10) / 10));
  tab.zoom = z;
  store.views[id].webContents.setZoomFactor(z);
  config.save();
}

function navigate(dir, id = store.active) {
  const h = store.views[id] && store.views[id].webContents.navigationHistory;
  if (!h) return;
  if (dir < 0 && h.canGoBack()) h.goBack();
  if (dir > 0 && h.canGoForward()) h.goForward();
}

// ---------- slaapstand ----------
// Nu laten slapen. Is het het tabblad dat je bekijkt? Dan eerst naar een ander.
function sleepNow(id = store.active) {
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  if (store.active === id) {
    const next = tabs[i + 1] || tabs[i - 1];
    views.show(next ? next.id : 'home');
  }
  require('./sleep').sleep(id);
}

// ---------- app ----------
function back() {
  if (store.lastTab && store.config.tabs.some(t => t.id === store.lastTab)) views.show(store.lastTab);
}

function toggleFullScreen() {
  store.win.setFullScreen(!store.win.isFullScreen());
}

function showShortcuts() {
  require('./palette').hide();
  views.show('home');
  views.whenReady('home', (h) => h.webContents.send('show-shortcuts'));
}

function setSetting(key, value) {
  if (!(key in config.DEFAULT_SETTINGS)) return;
  if (key === 'hiddenServices' || key === 'cardOrder') {
    value = Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && CATALOG[x]))] : [];
  }
  store.config.settings[key] = value;
  config.save();
  if (key === 'spellcheck') {
    for (const v of Object.values(store.views)) v.webContents.session.setSpellCheckerEnabled(value);
  }
  if (key === 'shareMicrosoft') {
    // Microsoft-tabbladen opnieuw laden met de nieuwe opslag
    for (const tab of store.config.tabs) {
      if (!CATALOG[tab.service].group || require('./sleep').isAsleep(tab.id)) continue;
      views.destroyView(tab.id);
      views.createServiceView(tab);
    }
    views.layout();
  }
  if (key === 'brightspaceUrl') {
    // Nieuw adres: alle Brightspace-tabbladen gaan naar het nieuwe adres
    const clean = require('./catalog').normalizeUrl(value) || '';
    store.config.settings.brightspaceUrl = clean;
    config.save();
    for (const tab of store.config.tabs) {
      if (tab.service !== 'brightspace') continue;
      delete tab.url;
      if (store.views[tab.id]) store.views[tab.id].webContents.loadURL(urlFor(tab));
    }
    require('./icons').refresh(); // logo van de nieuwe school
  }
  if (key === 'tabBar') { store.barRevealed = false; views.layout(); views.watchEdge(); }
  if (key === 'runInBackground') require('./tray').sync();
  if (key === 'unreadBadges') require('./unread').changed();
  if (key === 'autostart') require('./autostart').sync();
  if (key === 'autoUpdate') require('./updater').sync();
  if (key === 'followSystemDnd') require('./dnd').apply();
  if (key === 'theme') require('./theme').apply();
  views.broadcast();
}

// Alle logins (cookies) naar schijf schrijven (bij afsluiten en voor een update)
async function flushLogins() {
  const parts = new Set([...store.config.tabs.map(microsoft.partitionFor), ...microsoft.keptSessions]);
  await Promise.all([...parts].map(p =>
    session.fromPartition(p).cookies.flushStore().catch(() => {})
  ));
}

let flushing = false;
async function quit() {
  store.quitting = true; // kruisje-gedrag uit: venster mag nu echt dicht
  if (flushing) return;
  flushing = true;
  await flushLogins();
  require('./tray').destroy();
  app.quit();
}

Object.assign(module.exports, {
  addTab, closeTab, reopenTab, removeTab, addCustom, updateCustom, removeCustom,
  moveTab, reorderTab, cycle, goToIndex,
  reload, reloadAll, toggleMute, zoom, navigate, sleepNow,
  back, toggleFullScreen, showShortcuts, setSetting, quit, flushLogins
});
