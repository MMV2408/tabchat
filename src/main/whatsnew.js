// "What's new": a small window on the + screen with the changes per version.
// After an update a "✨ New in …" button appears in the tab bar (no popup); clicking it opens
// this window. Also via "What's new" under About Tabchat.
const { app } = require('electron');
const store = require('./store');
const views = require('./views');
const i18n = require('./i18n');
const changelog = require('./changelog');

function data(from) {
  return { current: app.getVersion(), updated: !!from, entries: changelog.since(from, i18n.lang()) };
}

function send(from) {
  views.show('home');
  views.whenReady('home', (h) => h.webContents.send('whats-new', data(from)));
}

// From a click (the ✨ button, a notification or the link): bring the window to the front.
// Without a version: the changes since the last update, if that button is still there.
function show(from, force = false) {
  const pending = store.config.whatsNew;
  if (from == null && pending) from = pending.from;
  if (pending) {
    store.config.whatsNew = null; // seen: the button goes away
    require('./config').save();
    views.broadcast();
  }
  require('./palette').hide();
  require('./tray').showWindow({ force });
  send(from);
}

// After an update: only put the "✨ New in …" button in the tab bar
function markNew(from) {
  if (!changelog.since(from, 'en').length) return require('./donate').afterWhatsNew();
  store.config.whatsNew = { from: from || null, to: app.getVersion() };
  require('./config').save();
  views.broadcast();
}

module.exports = { show, markNew };
