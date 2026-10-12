// Automatic updates via GitHub Releases (electron-updater).
// Tabchat checks on startup and every 6 hours after that for a new version,
// downloads it in the background and then asks whether you want to install.
// With a .deb, Ubuntu asks for your password.
const { app, Notification } = require('electron');
const path = require('path');
const store = require('./store');
const views = require('./views');
const { t } = require('./i18n');
const platform = require('./platform');
const { newer } = require('./changelog');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  // electron-updater not installed: updates off
}

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

// Update log: ~/.config/tabchat/updater.log (a user can send it along when updating fails)
const ulog = require('./log').create('updater');
const log = (level, ...parts) => ulog[level](...parts);
if (autoUpdater) {
  autoUpdater.logger = {
    info: (...a) => log('info', ...a),
    warn: (...a) => log('warn', ...a),
    error: (...a) => log('error', ...a),
    debug: () => {}
  };
}
let timer = null;

// State for the + screen, the tab bar and the tray menu
const status = {
  current: app.getVersion(),
  state: 'idle',   // idle | checking | latest | downloading | ready | failed | error | dev | off | store
  store: platform.storeName, // Flathub / Snap Store: they handle updates
  version: null,
  percent: 0
};

function set(changes) {
  Object.assign(status, changes);
  views.broadcast();
}

function enabled() {
  return store.config.settings.autoUpdate;
}

// After an update: tell once that it worked
function announceUpdate() {
  if (!app.isPackaged) return; // npm start: remember nothing and report nothing
  const now = app.getVersion();
  const before = store.config.lastVersion;
  if (before === now) return;
  store.config.lastVersion = now;
  require('./config').save();
  if (before && newer(before, now)) return; // older version started: no "updated" notification
  // No previous version known? Then only report if Tabchat was used before
  // (versions before 1.9.1 didn't remember their version number yet)
  if (!before && store.config.tabs.length === 0) return require('./donate').schedule('install');
  // After an update: show "What's new"; the donation request comes when you close it
  require('./donate').schedule('update');
  require('./whatsnew').showAfterUpdate(before);
  require('./notify').notify({
    title: t('upd.doneTitle', { v: now }),
    body: before ? t('upd.doneBodyFrom', { v: before }) : t('upd.doneBody'),
    onClick: () => require('./whatsnew').show(before)
  });
}

function init() {
  // First start after an install or update? Then no feedback request (see feedback.js)
  const special = app.isPackaged && store.config.lastVersion !== app.getVersion();
  announceUpdate();
  require('./feedback').start(special);
  if (platform.storeManaged) return set({ state: 'store' }); // updates through the store
  if (!app.isPackaged || !autoUpdater) return set({ state: 'dev' }); // npm start: no updates
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // the user chooses when (password needed for .deb)

  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ state: 'latest' }));
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => set({ percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'ready', version: info.version });
    // Notification click: go to "About Tabchat" with the Install now button
    require('./notify').notify({
      title: t('upd.readyTitle', { v: info.version }),
      body: t('upd.readyBody'),
      onClick: showUpdate
    });
  });
  autoUpdater.on('error', (err) => {
    log('error', 'event error', err);
    // Error while installing (e.g. password refused): the update stays ready
    if (installing) { installing = false; set({ state: 'failed' }); return require('./tray').showWindow(); }
    set({ state: 'error' });
  });

  sync();
}

function sync() {
  if (!app.isPackaged || !autoUpdater || platform.storeManaged) return;
  clearInterval(timer);
  if (!enabled()) return set({ state: 'off' });
  if (status.state === 'off') set({ state: 'idle' });
  check();
  timer = setInterval(check, 6 * 60 * 60 * 1000);
}

// Check now (also via the button on the + screen)
function check() {
  if (platform.storeManaged) return;
  if (!app.isPackaged || !autoUpdater) return set({ state: 'dev' });
  if (status.state === 'downloading' || status.state === 'ready') return;
  autoUpdater.checkForUpdates().catch(() => set({ state: 'error' }));
}

// Show the window on the + screen, scrolled to the update button
function showUpdate() {
  require('./tray').showWindow();
  views.show('home');
  views.whenReady('home', (h) => h.webContents.executeJavaScript(
    "document.getElementById('about').scrollIntoView({ behavior: 'smooth', block: 'center' })"
  ).catch(e => log('warn', 'scroll to update button:', e)));
}

// Install and restart Tabchat.
// If it fails (e.g. password window dismissed), Tabchat just keeps running
// and the update is ready again next time.
let installing = false;
async function install() {
  log('info', `Install now clicked (state ${status.state}, version ${status.version}, busy ${installing})`);
  if ((status.state !== 'ready' && status.state !== 'failed') || !autoUpdater || installing) return;
  installing = true;
  // Save logins first (wait at most 3 seconds, so it never hangs)
  await Promise.race([require('./actions').flushLogins(), new Promise(r => setTimeout(r, 3000))]);
  log('info', 'logins saved, starting install');
  // Hide the window: while the password dialog is open Tabchat waits for the install, and Ubuntu
  // would ask "not responding: force quit?". It doesn't ask that for a hidden window.
  if (store.alive()) store.win.hide();
  // Quitting (tray gone, window closed) only happens via 'before-quit' once the install succeeded
  try {
    autoUpdater.quitAndInstall(false, true); // false = not silent, true = restart afterwards
  } catch (e) { log('error', 'quitAndInstall', e); }
  // Still here after a few seconds? Then it failed or was cancelled: report it and show the button again
  setTimeout(() => {
    if (store.quitting) return;
    log('warn', 'install failed or was cancelled');
    installing = false;
    set({ state: 'failed' });
    require('./tray').showWindow(); // window back, with the message
  }, 3000);
}

function getStatus() {
  return { ...status };
}

Object.assign(module.exports, { init, sync, check, install, getStatus });
