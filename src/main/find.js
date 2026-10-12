// Find in page (Ctrl+F): a small bar at the top right of the active tab.
// The bar is its own small view (find.html) that is only loaded when you open it.
const store = require('./store');

let target = null;  // webContents being searched
let lastText = '';

function bounds() {
  const views = require('./views');
  const area = views.contentArea();
  const halves = require('./split').place(area);
  const pane = (halves && halves[store.active]) || area;
  const w = Math.min(380, pane.width - 16);
  return { x: pane.x + pane.width - w - 12, y: pane.y + 8, width: w, height: 48 };
}

function open() {
  const v = store.views[store.active];
  if (!v) return; // only in a service tab
  const views = require('./views');
  if (target && target !== v.webContents) stopSearch();
  target = v.webContents;
  store.findOpen = true;
  views.page('find');
  views.layout();
  views.whenReady('find', (f) => {
    if (!store.findOpen) return;
    f.webContents.send('find-open', lastText);
    f.webContents.focus();
  });
}

function stopSearch() {
  if (target && !target.isDestroyed()) target.stopFindInPage('keepSelection');
}

function close() {
  if (!store.findOpen) return;
  stopSearch();
  store.findOpen = false;
  target = null;
  const views = require('./views');
  views.layout();
  views.focusActive();
  views.dropLater('find', 60 * 1000);
}

// From the bar: search (again). next = jump to the next match, back = search backwards
function search(text, next, back) {
  if (!target || target.isDestroyed()) return;
  lastText = text;
  if (!text) { target.stopFindInPage('clearSelection'); return report(0, 0); }
  target.findInPage(text, { findNext: !!next, forward: !back });
}

function report(active, total) {
  if (store.find && !store.find.webContents.isDestroyed()) store.find.webContents.send('find-result', active, total);
}

// Called for every service tab (views.createServiceView)
function watch(wc) {
  wc.on('found-in-page', (_e, r) => {
    if (wc === target && r.finalUpdate) report(r.activeMatchOrdinal, r.matches);
  });
}

module.exports = { open, close, search, watch, bounds };
