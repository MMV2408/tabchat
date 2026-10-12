// Counting unread messages.
// Services report the count in two ways:
// - in the page title, e.g. "(45) WhatsApp", "(2) Teams..." or "• Discord"
// - via the app badge (navigator.setAppBadge), see preload/service.js
const { app } = require('electron');
const store = require('./store');
const views = require('./views');

// Per tab: a count, or 'dot' (something new, but no number known).
// Two sources: the page title and the app badge (see preload/service.js).
const fromTitle = {};
const fromBadge = {};

// Badge wins; otherwise whatever the title says
function value(id) {
  return fromBadge[id] || fromTitle[id] || 0;
}

// "(3) WhatsApp" -> 3, "(99+) ..." -> 99, "• Discord" -> 'dot', otherwise 0
function parse(title) {
  const m = title.match(/\((\d+)\+?\)/);
  if (m) return Number(m[1]);
  if (/^\s*[•●]/.test(title)) return 'dot';
  return 0;
}

function enabled() {
  return store.config.settings.unreadBadges;
}

// Start watching a tab
function watch(tab, view) {
  view.webContents.on('page-title-updated', (_e, title) => {
    update(fromTitle, tab.id, parse(title));
  });
}

// Badge count of a tab (via ipc.js)
function setBadge(id, n) {
  update(fromBadge, id, n);
}

function update(map, id, n) {
  const before = value(id);
  if (n) map[id] = n; else delete map[id];
  if (value(id) !== before) changed();
}

// Tab closed: drop its counter
function forget(id) {
  const had = value(id);
  delete fromTitle[id];
  delete fromBadge[id];
  if (had) changed();
}

// ---------- reading ----------
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

// ---------- updating everything ----------
function changed() {
  if (!store.alive()) return; // window already closed (e.g. while quitting)
  const t = total();
  app.setBadgeCount(t);                                  // number on the dock icon
  store.win.setTitle(t ? `Tabchat (${t})` : 'Tabchat');  // window title (Alt+Tab)
  views.broadcast();                                     // tab bar + tray menu
}

Object.assign(module.exports, { watch, setBadge, forget, get, total, any, changed });
