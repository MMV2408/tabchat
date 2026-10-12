// Feedback request: one small window after 7 days of use, with a link to a short form.
// - never on the first start after an install or update ("What's new" and the donation request come then)
// - never within 3 days of the donation request
// - "Later" asks once more after 14 days; never again after that
// Nothing is sent automatically: the user opens the form themselves. Not with npm start.
const { app, dialog, shell } = require('electron');
const path = require('path');
const store = require('./store');
const config = require('./config');
const { t } = require('./i18n');

const URL = 'https://tally.so/r/LZAaop';
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const DAY = 24 * 3600 * 1000;

function open() {
  shell.openExternal(URL);
}

function state() {
  if (!store.config.feedback) store.config.feedback = { done: false, laterCount: 0, nextAt: 0 };
  return store.config.feedback;
}

function due() {
  const f = state();
  const now = Date.now();
  if (f.done || !store.config.firstUse) return false;
  if (now < store.config.firstUse + 7 * DAY || now < (f.nextAt || 0)) return false;
  if (store.config.donateAskedAt && now < store.config.donateAskedAt + 3 * DAY) return false;
  return true;
}

async function ask() {
  if (!due() || store.quitting || !store.win) return;
  const f = state();
  const { response, checkboxChecked } = await dialog.showMessageBox(store.win, {
    type: 'none',
    icon: ICON,
    title: t('fb.title'),
    message: t('fb.message'),
    detail: t('fb.detail'),
    buttons: [t('fb.yes'), t('fb.later')],
    checkboxLabel: t('fb.never'),
    defaultId: 0,
    cancelId: 1
  });
  if (response === 0) { f.done = true; open(); }
  else if (checkboxChecked || f.laterCount >= 1) f.done = true; // after one "Later", don't ask again
  else { f.laterCount = 1; f.nextAt = Date.now() + 14 * DAY; }
  if (checkboxChecked) f.done = true;
  config.save();
}

// On startup. special = first start after an install or update.
function start(special) {
  if (!app.isPackaged) return;
  if (!store.config.firstUse) { store.config.firstUse = Date.now(); config.save(); }
  if (special || !due()) return;
  // Calmly: only after 2 minutes, and only when the window is visible
  setTimeout(() => {
    if (!store.win) return;
    if (store.win.isVisible()) ask();
    else store.win.once('show', () => setTimeout(ask, 1500));
  }, 2 * 60 * 1000);
}

module.exports = { open, start };
