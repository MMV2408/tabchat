// Do not disturb: all notifications and sounds off, optionally for a set time.
// The notifications themselves are blocked in preload/service.js.
// When Do not disturb of Ubuntu (GNOME) is on, Tabchat follows automatically.
const { app } = require('electron');
const { spawn, execFile } = require('child_process');
const platform = require('./platform');
const store = require('./store');
const config = require('./config');
const views = require('./views');
const i18n = require('./i18n');

let timer = null;
let systemOn = false; // Do not disturb of Ubuntu/GNOME

// Turned on in Tabchat itself?
function isManual() {
  const until = store.config.dndUntil;
  if (!until) return false;
  if (until === 'forever') return true;
  return Date.now() < until;
}

// Turned on via Ubuntu (and the setting is on)?
function isSystem() {
  return systemOn && store.config.settings.followSystemDnd;
}

// Is Do not disturb on right now?
function isOn() {
  return isManual() || isSystem();
}

// ---------- follow Ubuntu's Do not disturb ----------
// GNOME stores this as "show-banners" (false = Do not disturb on).
// In Flathub/Snap Tabchat can't read it; GNOME already hides the notifications there itself.
function setSystem(on) {
  if (on === systemOn) return;
  systemOn = on;
  apply();
}

function watchSystem() {
  if (platform.storeManaged) return;
  const KEY = ['org.gnome.desktop.notifications', 'show-banners'];
  execFile('gsettings', ['get', ...KEY], (err, out) => {
    if (!err) setSystem(String(out).trim() === 'false');
  });
  try {
    const p = spawn('gsettings', ['monitor', ...KEY]);
    p.on('error', () => {}); // not GNOME: then nothing
    p.stdout.on('data', (d) => setSystem(/false\s*$/.test(String(d).trim())));
    app.on('will-quit', () => p.kill());
  } catch (e) {
    require('./log').info('gsettings monitor not available:', e.message); // not GNOME
  }
}

// mode: number of minutes, 'tomorrow' (until 08:00 tomorrow), 'forever' or null (off)
function set(mode) {
  let until = null;
  if (mode === 'forever') {
    until = 'forever';
  } else if (mode === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    until = d.getTime();
  } else if (typeof mode === 'number' && mode > 0) {
    until = Date.now() + mode * 60 * 1000;
  }
  store.config.dndUntil = until;
  config.save();
  apply();
}

// Apply to all tabs (and set a timer for the end)
function apply() {
  clearTimeout(timer);
  const on = isOn();

  // Time's up? Then clean up
  if (!isManual() && store.config.dndUntil) {
    store.config.dndUntil = null;
    config.save();
  }
  if (isManual() && store.config.dndUntil !== 'forever') {
    timer = setTimeout(apply, Math.min(store.config.dndUntil - Date.now(), 2 ** 31 - 1));
  }

  for (const [id, v] of Object.entries(store.views)) {
    applyToView(id, v);
    v.webContents.send('dnd', on); // block notifications in the tab
  }
  views.broadcast();
}

// Sound: off with Do not disturb, or when the tab itself is muted
function applyToView(id, v) {
  v.webContents.setAudioMuted(isOn() || store.mutedTabs.has(id));
}

// Text for tab bar, tray and Ctrl+K, e.g. "until 19:37" or "until 08:00 tomorrow"
function label() {
  if (!isManual()) return isSystem() ? i18n.t('dnd.system') : null;
  const until = store.config.dndUntil;
  if (until === 'forever') return i18n.t('dnd.untilOff');
  const d = new Date(until);
  const time = d.toLocaleTimeString(i18n.lang() === 'nl' ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const today = d.toDateString() === new Date().toDateString();
  return i18n.t(today ? 'dnd.until' : 'dnd.untilTomorrow', { t: time });
}

Object.assign(module.exports, { isOn, isManual, set, apply, applyToView, label, watchSystem });
