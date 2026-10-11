// Vraag om te doneren: één klein venster na de eerste installatie en na elke update,
// tot iemand "Niet meer tonen" aanvinkt. Niet bij npm start.
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

// Pas tonen als het venster zichtbaar is (niet bij verborgen starten in de tray)
function showWhenVisible() {
  if (store.win.isVisible()) ask();
  else store.win.once('show', () => setTimeout(ask, 1500));
}

// kind: 'install' (eerste keer) of 'update'
let afterUpdate = false;
function schedule(kind) {
  if (!app.isPackaged || store.config.donateNever) return;
  // Na een update: pas vragen als "Wat is er nieuw" gesloten is
  if (kind === 'update') { afterUpdate = true; return; }
  // Eerste keer: eerst rustig diensten toevoegen en inloggen
  setTimeout(() => { if (store.win) showWhenVisible(); }, 3 * 60 * 1000);
}

// "Wat is er nieuw" is gesloten (of er was niets nieuws)
function afterWhatsNew() {
  if (!afterUpdate) return;
  afterUpdate = false;
  setTimeout(() => { if (store.win) showWhenVisible(); }, 1500);
}

module.exports = { open, schedule, afterWhatsNew };
