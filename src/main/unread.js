// Ongelezen berichten tellen.
// Twee manieren waarop diensten het aantal doorgeven:
// - in de paginatitel, bv. "(45) WhatsApp", "(2) Teams..." of "• Discord"
// - via de app-badge (navigator.setAppBadge), zie preload/service.js
const { app } = require('electron');
const store = require('./store');
const views = require('./views');

// Per tabblad: aantal, of 'dot' (wel nieuw, maar geen getal bekend).
// Twee bronnen: de paginatitel en de app-badge (zie preload/service.js).
const fromTitle = {};
const fromBadge = {};

// Badge gaat voor; anders wat er in de titel staat
function value(id) {
  return fromBadge[id] || fromTitle[id] || 0;
}

// "(3) WhatsApp" -> 3, "(99+) ..." -> 99, "• Discord" -> 'dot', anders 0
function parse(title) {
  const m = title.match(/\((\d+)\+?\)/);
  if (m) return Number(m[1]);
  if (/^\s*[•●]/.test(title)) return 'dot';
  return 0;
}

function enabled() {
  return store.config.settings.unreadBadges;
}

// Een tabblad in de gaten houden
function watch(tab, view) {
  view.webContents.on('page-title-updated', (_e, title) => {
    update(fromTitle, tab.id, parse(title));
  });
}

// Badge-getal van een tabblad (via ipc.js)
function setBadge(id, n) {
  update(fromBadge, id, n);
}

function update(map, id, n) {
  const before = value(id);
  if (n) map[id] = n; else delete map[id];
  if (value(id) !== before) changed();
}

// Tabblad gesloten: teller weg
function forget(id) {
  const had = value(id);
  delete fromTitle[id];
  delete fromBadge[id];
  if (had) changed();
}

// ---------- uitlezen ----------
function get(id) {
  return enabled() ? value(id) : 0;
}

function total() {
  if (!enabled()) return 0;
  return Object.keys(store.views).reduce((sum, id) => {
    const c = value(id);
    return sum + (typeof c === 'number' ? c : 0);
  }, 0);
}

function any() {
  return enabled() && Object.keys(store.views).some(id => value(id));
}

// ---------- alles bijwerken ----------
function changed() {
  if (!store.alive()) return; // venster is al dicht (bv. tijdens afsluiten)
  const t = total();
  app.setBadgeCount(t);                                  // getal op het dock-icoon
  store.win.setTitle(t ? `Tabchat (${t})` : 'Tabchat');  // venstertitel (Alt+Tab)
  views.broadcast();                                     // tabbalk + tray-menu
}

Object.assign(module.exports, { watch, setBadge, forget, get, total, any, changed });
