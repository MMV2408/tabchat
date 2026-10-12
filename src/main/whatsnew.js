// "What's new": a small window on the + screen with the changes per version.
// Shows up by itself after an update, and via "What's new" under About Tabchat.
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

// From a click (notification or link): bring the window to the front
function show(from, force = false) {
  require('./palette').hide();
  require('./tray').showWindow({ force });
  send(from);
}

// After an update: show once the + screen is loaded and the window is visible
function showAfterUpdate(from) {
  if (!changelog.since(from, 'en').length) return require('./donate').afterWhatsNew();
  const go = () => setTimeout(() => send(from), 1200);
  const whenVisible = () => (store.win.isVisible() ? go() : store.win.once('show', go));
  whenVisible();
}

module.exports = { show, showAfterUpdate };
