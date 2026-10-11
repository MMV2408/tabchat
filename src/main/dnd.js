// Niet storen: alle meldingen en geluiden uit, eventueel voor een bepaalde tijd.
// De meldingen zelf worden tegengehouden in preload/service.js.
// Staat "Niet storen" van Ubuntu (GNOME) aan, dan doet Tabchat automatisch mee.
const { app } = require('electron');
const { spawn, execFile } = require('child_process');
const platform = require('./platform');
const store = require('./store');
const config = require('./config');
const views = require('./views');
const i18n = require('./i18n');

let timer = null;
let systemOn = false; // Niet storen van Ubuntu/GNOME

// Zelf aangezet in Tabchat?
function isManual() {
  const until = store.config.dndUntil;
  if (!until) return false;
  if (until === 'forever') return true;
  return Date.now() < until;
}

// Via Ubuntu aangezet (en de instelling staat aan)?
function isSystem() {
  return systemOn && store.config.settings.followSystemDnd;
}

// Staat Niet storen nu aan?
function isOn() {
  return isManual() || isSystem();
}

// ---------- Niet storen van Ubuntu volgen ----------
// GNOME bewaart dit als "show-banners" (false = Niet storen aan).
// In Flathub/Snap kan Tabchat daar niet bij; GNOME verbergt de meldingen daar zelf al.
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
    p.on('error', () => {}); // geen GNOME: dan niets
    p.stdout.on('data', (d) => setSystem(/false\s*$/.test(String(d).trim())));
    app.on('will-quit', () => p.kill());
  } catch {}
}

// mode: aantal minuten, 'tomorrow' (tot morgen 08:00), 'forever' of null (uit)
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

// Toepassen op alle tabbladen (en een timer zetten voor het einde)
function apply() {
  clearTimeout(timer);
  const on = isOn();

  // Tijd voorbij? Dan opruimen
  if (!isManual() && store.config.dndUntil) {
    store.config.dndUntil = null;
    config.save();
  }
  if (isManual() && store.config.dndUntil !== 'forever') {
    timer = setTimeout(apply, Math.min(store.config.dndUntil - Date.now(), 2 ** 31 - 1));
  }

  for (const [id, v] of Object.entries(store.views)) {
    applyToView(id, v);
    v.webContents.send('dnd', on); // meldingen in het tabblad tegenhouden
  }
  views.broadcast();
}

// Geluid: uit bij Niet storen, of als het tabblad zelf gedempt is
function applyToView(id, v) {
  v.webContents.setAudioMuted(isOn() || store.mutedTabs.has(id));
}

// Tekst voor tabbalk, tray en Ctrl+K, bv. "tot 19:37" of "tot morgen 08:00"
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
