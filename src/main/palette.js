// The quick search window (Ctrl+K)
const store = require('./store');
const views = require('./views');
const actions = require('./actions');
const { CATALOG } = require('./catalog');
const dnd = require('./dnd');

// Actions you can pick from Ctrl+K. New action = one line here
// (and a line in palette.html so it shows up in the list).
const ACTIONS = {
  reload: () => actions.reload(),
  reloadAll: () => actions.reloadAll(),
  mute: () => actions.toggleMute(),
  sleepNow: () => actions.sleepNow(),
  close: () => actions.closeTab(),
  reopen: () => actions.reopenTab(),
  zoomIn: () => actions.zoom(0.1),
  zoomOut: () => actions.zoom(-0.1),
  zoomReset: () => actions.zoom(0),
  fullscreen: () => actions.toggleFullScreen(),
  settings: () => views.show('home'),
  shortcuts: () => actions.showShortcuts(),
  quit: () => actions.quit(),
  dnd60: () => dnd.set(60),
  dndTomorrow: () => dnd.set('tomorrow'),
  dndForever: () => dnd.set('forever'),
  dndOff: () => dnd.set(null)
};

function bringToFront() {
  if (!store.palette) return;
  // addChildView on a view that is already there moves it to the top. Don't remove it first:
  // with Electron 44 a removed and re-added screen stays "hidden" for good (no drawing, no input),
  // which made Ctrl+K an invisible layer over the whole window.
  store.win.contentView.addChildView(store.palette);
  if (store.share) store.win.contentView.addChildView(store.share);
}

function open() {
  store.paletteOpen = true;
  views.page('palette'); // only load it when needed
  bringToFront();
  views.layout();
  views.whenReady('palette', (v) => {
    if (!store.paletteOpen) return;
    v.webContents.send('palette-open', views.getState());
    v.webContents.focus();
  });
}

function hide() {
  if (!store.paletteOpen) return;
  store.paletteOpen = false;
  views.layout();
  views.focusActive();
  views.dropLater('palette', 60 * 1000); // unused for a minute: free the memory
}

function toggle() {
  if (store.paletteOpen) hide(); else open();
}

function run(item) {
  hide();
  if (!item) return;
  if (item.type === 'tab' && store.config.tabs.some(t => t.id === item.id)) views.show(item.id);
  else if (item.type === 'add' && CATALOG[item.service]) actions.addTab(item.service);
  else if (item.type === 'action' && ACTIONS[item.id]) ACTIONS[item.id]();
}

Object.assign(module.exports, { bringToFront, open, hide, toggle, run });
