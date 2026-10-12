// Automatische updates via GitHub Releases (electron-updater).
// Tabchat kijkt bij het opstarten en daarna elke 6 uur of er een nieuwe versie is,
// downloadt die op de achtergrond en vraagt dan of je wilt installeren.
// Bij een .deb vraagt Ubuntu daarbij om je wachtwoord.
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
  // electron-updater niet geïnstalleerd: updates uit
}

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

// Logboek van de updater: ~/.config/tabchat/updater.log (bij problemen kan een gebruiker dit meesturen)
const LOG = path.join(app.getPath('userData'), 'updater.log');
function log(level, ...parts) {
  try {
    const fs = require('fs');
    try { if (fs.statSync(LOG).size > 256 * 1024) fs.renameSync(LOG, LOG + '.old'); } catch {}
    const text = parts.map(x => (x instanceof Error ? x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${app.getVersion()} [${level}] ${text}\n`);
  } catch {}
}
if (autoUpdater) {
  autoUpdater.logger = {
    info: (...a) => log('info', ...a),
    warn: (...a) => log('warn', ...a),
    error: (...a) => log('error', ...a),
    debug: () => {}
  };
}
let timer = null;

// Status voor het +-scherm, de tabbalk en het tray-menu
const status = {
  current: app.getVersion(),
  state: 'idle',   // idle | checking | latest | downloading | ready | failed | error | dev | off | store
  store: platform.storeName, // Flathub / Snap Store: die regelen de updates
  version: null,   // nieuwe versie, als die er is
  percent: 0
};

function set(changes) {
  Object.assign(status, changes);
  views.broadcast();
}

function enabled() {
  return store.config.settings.autoUpdate;
}

// Na een update: eenmalig laten weten dat het gelukt is
function announceUpdate() {
  if (!app.isPackaged) return; // npm start: niets onthouden en niets melden
  const now = app.getVersion();
  const before = store.config.lastVersion;
  if (before === now) return;
  store.config.lastVersion = now;
  require('./config').save();
  if (before && newer(before, now)) return; // oudere versie gestart: geen "bijgewerkt"-melding
  // Geen vorige versie bekend? Dan alleen melden als Tabchat al eerder gebruikt is
  // (versies van vóór 1.9.1 onthielden hun versienummer nog niet)
  if (!before && store.config.tabs.length === 0) return require('./donate').schedule('install');
  // Na een update: "Wat is er nieuw" tonen; de doneervraag komt pas als je dat sluit
  require('./donate').schedule('update');
  require('./whatsnew').showAfterUpdate(before);
  require('./notify').notify({
    title: t('upd.doneTitle', { v: now }),
    body: before ? t('upd.doneBodyFrom', { v: before }) : t('upd.doneBody'),
    onClick: () => require('./whatsnew').show(before)
  });
}

function init() {
  // Eerste start na installatie of update? Dan geen feedbackvraag (zie feedback.js)
  const special = app.isPackaged && store.config.lastVersion !== app.getVersion();
  announceUpdate();
  require('./feedback').start(special);
  if (platform.storeManaged) return set({ state: 'store' }); // updates via de winkel
  if (!app.isPackaged || !autoUpdater) return set({ state: 'dev' }); // npm start: geen updates
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // zelf kiezen wanneer (wachtwoord nodig bij .deb)

  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ state: 'latest' }));
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => set({ percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'ready', version: info.version });
    // Klik op de melding: naar "Over Tabchat" met de knop Nu installeren
    require('./notify').notify({
      title: t('upd.readyTitle', { v: info.version }),
      body: t('upd.readyBody'),
      onClick: showUpdate
    });
  });
  autoUpdater.on('error', (err) => {
    console.error('Update-fout:', err && err.message);
    log('error', 'event error', err);
    // Fout tijdens installeren (bv. wachtwoord geweigerd): update blijft klaarstaan
    if (installing) { installing = false; set({ state: 'failed' }); return require('./tray').showWindow(); }
    set({ state: 'error' });
  });

  sync();
}

// Aan/uit volgens de instelling
function sync() {
  if (!app.isPackaged || !autoUpdater || platform.storeManaged) return;
  clearInterval(timer);
  if (!enabled()) return set({ state: 'off' });
  if (status.state === 'off') set({ state: 'idle' });
  check();
  timer = setInterval(check, 6 * 60 * 60 * 1000);
}

// Nu controleren (ook via de knop in het +-scherm)
function check() {
  if (platform.storeManaged) return;
  if (!app.isPackaged || !autoUpdater) return set({ state: 'dev' });
  if (status.state === 'downloading' || status.state === 'ready') return;
  autoUpdater.checkForUpdates().catch(() => set({ state: 'error' }));
}

// Venster tonen op het +-scherm, gescrold naar de update-knop
function showUpdate() {
  require('./tray').showWindow();
  views.show('home');
  views.whenReady('home', (h) => h.webContents.executeJavaScript(
    "document.getElementById('about').scrollIntoView({ behavior: 'smooth', block: 'center' })"
  ).catch(() => {}));
}

// Installeren en Tabchat opnieuw starten
// Lukt het niet (bv. wachtwoord-venster weggeklikt), dan blijft Tabchat gewoon draaien
// en staat de update de volgende keer weer klaar.
let installing = false;
async function install() {
  log('info', `Nu installeren geklikt (status ${status.state}, versie ${status.version}, bezig ${installing})`);
  if ((status.state !== 'ready' && status.state !== 'failed') || !autoUpdater || installing) return;
  installing = true;
  // Logins eerst opslaan (maximaal 3 seconden wachten, zodat het nooit blijft hangen)
  await Promise.race([require('./actions').flushLogins(), new Promise(r => setTimeout(r, 3000))]);
  log('info', 'logins opgeslagen, installeren starten');
  // Venster verbergen: tijdens het wachtwoordvenster wacht Tabchat op het installeren, en dan zou
  // Ubuntu vragen "reageert niet: geforceerd afsluiten?". Bij een verborgen venster vraagt hij dat niet.
  if (store.alive()) store.win.hide();
  // Afsluiten (tray weg, venster dicht) gebeurt pas via 'before-quit' als de installatie gelukt is
  try {
    autoUpdater.quitAndInstall(false, true); // false = niet stil, true = daarna opnieuw starten
  } catch (e) { log('error', 'quitAndInstall', e); }
  // Nog steeds hier na een paar seconden? Dan is het mislukt of afgebroken: melden en knop weer tonen
  setTimeout(() => {
    if (store.quitting) return;
    log('warn', 'installeren niet gelukt of afgebroken');
    installing = false;
    set({ state: 'failed' });
    require('./tray').showWindow(); // venster terug, met de melding
  }, 3000);
}

function getStatus() {
  return { ...status };
}

Object.assign(module.exports, { init, sync, check, install, getStatus });
