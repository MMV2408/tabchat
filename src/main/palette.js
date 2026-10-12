// Het snelzoekvenster (Ctrl+K)
const store = require('./store');
const views = require('./views');
const actions = require('./actions');
const { CATALOG } = require('./catalog');
const dnd = require('./dnd');

// Acties die je vanuit Ctrl+K kunt kiezen. Nieuwe actie = één regel hier
// (en een regel in palette.html zodat hij in de lijst staat).
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

// Het venster bovenop alle tabbladen leggen
function bringToFront() {
  if (!store.palette) return;
  store.win.contentView.removeChildView(store.palette);
  store.win.contentView.addChildView(store.palette);
  if (store.share) { store.win.contentView.removeChildView(store.share); store.win.contentView.addChildView(store.share); }
}

function open() {
  store.paletteOpen = true;
  views.page('palette'); // pas laden als je hem nodig hebt
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
  views.dropLater('palette', 60 * 1000); // een minuut niet gebruikt: uit het geheugen
}

function toggle() {
  if (store.paletteOpen) hide(); else open();
}

// Een gekozen regel uitvoeren
function run(item) {
  hide();
  if (!item) return;
  if (item.type === 'tab' && store.config.tabs.some(t => t.id === item.id)) views.show(item.id);
  else if (item.type === 'add' && CATALOG[item.service]) actions.addTab(item.service);
  else if (item.type === 'action' && ACTIONS[item.id]) ACTIONS[item.id]();
}

Object.assign(module.exports, { bringToFront, open, hide, toggle, run });
