// Split view: two tabs side by side, with a draggable divider in between.
// The pair is stored in config.split = { left, right, ratio }. Clicking one of the two tabs
// shows both; clicking another tab shows that one alone (the pair stays for later).
const { WebContentsView, Menu, screen } = require('electron');
const path = require('path');
const store = require('./store');
const config = require('./config');
const { t } = require('./i18n');

const DIVIDER = 10;         // divider width in pixels
const MIN = 0.2, MAX = 0.8; // each side gets at least 20%
let divider = null;
let dragging = false;

// The pair, or null (also cleans up a pair whose tab no longer exists)
function pair() {
  const s = store.config && store.config.split;
  if (!s) return null;
  const ids = store.config.tabs.map(x => x.id);
  if (!ids.includes(s.left) || !ids.includes(s.right) || s.left === s.right) {
    store.config.split = null;
    return null;
  }
  return s;
}
const has = (id) => { const s = pair(); return !!s && (s.left === id || s.right === id); };
const isShown = () => has(store.active);
// Is this tab visible right now (alone or as half of the split)?
const visible = (id) => id === store.active || (isShown() && has(id));

function open(a, b) {
  if (!a || !b || a === b) return;
  store.config.split = { left: a, right: b, ratio: 0.5 };
  config.save();
  require('./views').show(b);
}

function close() {
  if (!store.config.split) return;
  store.config.split = null;
  config.save();
  const views = require('./views');
  views.layout();
  views.broadcast();
}

// Ctrl+\ : split the current tab with the previous one, or undo the split
function toggle() {
  if (isShown()) return close();
  const tabs = store.config.tabs;
  const a = store.views[store.active] || tabs.some(x => x.id === store.active) ? store.active : store.lastTab;
  if (!a || a === 'home') return;
  const prev = store.prevTab && store.prevTab !== a && tabs.some(x => x.id === store.prevTab) ? store.prevTab : null;
  const i = tabs.findIndex(x => x.id === a);
  const b = prev || (tabs[i + 1] || tabs[i - 1] || {}).id;
  open(a, b);
}

// A tab was closed or removed
function forget(id) {
  if (has(id)) close();
}

// On startup: the other half may have started asleep, so wake it
function restore() {
  const s = pair();
  if (!s || !isShown()) return;
  const other = s.left === store.active ? s.right : s.left;
  require('./sleep').wake(other);
}

// ---------- layout (called from views.layout) ----------
// Returns { id: bounds } for the two halves, or null when the split isn't shown.
function place(area) {
  const s = pair();
  if (!s) {
    dropDivider(); // split closed: free its renderer (~20 MB)
    return null;
  }
  if (!isShown()) {
    if (divider) divider.setVisible(false);
    return null;
  }
  const leftW = Math.round((area.width - DIVIDER) * s.ratio);
  const ensure = ensureDivider();
  // While dragging, the divider covers the whole area so it keeps getting the mouse
  ensure.setBounds(dragging ? area : { x: area.x + leftW, y: area.y, width: DIVIDER, height: area.height });
  ensure.setVisible(true);
  return {
    [s.left]: { x: area.x, y: area.y, width: leftW, height: area.height },
    [s.right]: { x: area.x + leftW + DIVIDER, y: area.y, width: area.width - leftW - DIVIDER, height: area.height }
  };
}

function dropDivider() {
  if (!divider) return;
  const d = divider;
  divider = null;
  dragging = false;
  try { store.win.contentView.removeChildView(d); } catch (e) { require('./log').warn('divider remove:', e); }
  if (!d.webContents.isDestroyed()) d.webContents.close();
}

function ensureDivider() {
  if (divider) return divider;
  divider = new WebContentsView({ webPreferences: { preload: path.join(__dirname, '..', 'preload', 'preload.js') } });
  divider.setBackgroundColor('#00000000');
  divider.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'divider.html'));
  const cv = store.win.contentView;
  cv.addChildView(divider);
  // The tab bar, quick search and screen sharing stay on top
  for (const v of [store.bar, store.palette, store.share]) if (v) { cv.removeChildView(v); cv.addChildView(v); }
  return divider;
}

// ---------- dragging the divider ----------
function drag(phase, screenX) {
  const s = pair();
  if (!s) return;
  const views = require('./views');
  if (phase === 'start') dragging = true;
  if (phase === 'move' || phase === 'end') {
    const b = store.win.getContentBounds();
    const area = views.contentArea();
    const x = screenX - b.x - area.x;
    s.ratio = Math.min(MAX, Math.max(MIN, (x - DIVIDER / 2) / (area.width - DIVIDER)));
  }
  if (phase === 'end') { dragging = false; config.save(); }
  views.layout();
  if (divider && phase !== 'move') {
    const area = views.contentArea();
    divider.webContents.send('split-dragging', dragging, Math.round((area.width - DIVIDER) * s.ratio));
  }
}

function even() {
  const s = pair();
  if (!s) return;
  s.ratio = 0.5;
  config.save();
  require('./views').layout();
}

// Right-click on the divider
function menu() {
  Menu.buildFromTemplate([
    { label: t('menu.splitEven'), click: even },
    { label: t('menu.unsplit'), accelerator: 'Ctrl+\\', click: close }
  ]).popup({ window: store.win });
}

module.exports = { dividerView: () => divider, pair, has, isShown, visible, open, close, toggle, forget, restore, place, drag, even, menu };
