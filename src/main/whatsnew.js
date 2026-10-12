// "Wat is er nieuw": een venstertje in het +-scherm met de veranderingen per versie.
// Verschijnt vanzelf na een update, en via "Wat is er nieuw" onder Over Tabchat.
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

// Via een klik (melding of link): venster naar voren halen
function show(from, force = false) {
  require('./palette').hide();
  require('./tray').showWindow({ force });
  send(from);
}

// Na een update: tonen zodra het +-scherm geladen is en het venster zichtbaar is
function showAfterUpdate(from) {
  if (!changelog.since(from, 'en').length) return require('./donate').afterWhatsNew();
  const go = () => setTimeout(() => send(from), 1200);
  const whenVisible = () => (store.win.isVisible() ? go() : store.win.once('show', go));
  whenVisible();
}

module.exports = { show, showAfterUpdate };
