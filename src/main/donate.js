// Donation request: one small window after the first install and after each update,
// until someone ticks "Don't show again". Not with npm start.
const { app, dialog, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { t } = require('./i18n');

const URL = 'https://github.com/sponsors/MMV2408';
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

function open() {
  shell.openExternal(URL);
}

async function ask() {
  if (store.config.donateNever || store.quitting || !store.win) return;
  store.config.donateAskedAt = Date.now(); // no feedback request right after this (feedback.js)
  require('./config').save();
  const { response, checkboxChecked } = await dialog.showMessageBox(store.win, {
    type: 'none',
    icon: ICON,
    title: t('don.title'),
    message: t('don.message'),
    detail: t('don.detail'),
    buttons: [t('don.yes'), t('don.later')],
    checkboxLabel: t('don.never'),
    defaultId: 1,
    cancelId: 1
  });
  if (checkboxChecked) {
    store.config.donateNever = true;
    require('./config').save();
  }
  if (response === 0) open();
}

// Only show when the window is visible (not when starting hidden in the tray)
function showWhenVisible() {
  if (store.win.isVisible()) ask();
  else store.win.once('show', () => setTimeout(ask, 1500));
}

// kind: 'install' (first time) or 'update'
let afterUpdate = false;
function schedule(kind) {
  if (!app.isPackaged || store.config.donateNever) return;
  // After an update: only ask once "What's new" is closed
  if (kind === 'update') { afterUpdate = true; return; }
  // First time: let people add services and sign in first
  setTimeout(() => { if (store.win) showWhenVisible(); }, 3 * 60 * 1000);
}

// "What's new" was closed (or there was nothing new)
function afterWhatsNew() {
  if (!afterUpdate) return;
  afterUpdate = false;
  setTimeout(() => { if (store.win) showWhenVisible(); }, 1500);
}

module.exports = { open, schedule, afterWhatsNew };
