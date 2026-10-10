// Niet storen: alle meldingen en geluiden uit, eventueel voor een bepaalde tijd.
// De meldingen zelf worden tegengehouden in preload/service.js.
const store = require('./store');
const config = require('./config');
const views = require('./views');

let timer = null;

// Staat Niet storen nu aan?
function isOn() {
  const until = store.config.dndUntil;
  if (!until) return false;
  if (until === 'forever') return true;
  return Date.now() < until;
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
  if (!on && store.config.dndUntil) {
    store.config.dndUntil = null;
    config.save();
  }
  if (on && store.config.dndUntil !== 'forever') {
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
  if (!isOn()) return null;
  const until = store.config.dndUntil;
  if (until === 'forever') return 'tot je het uitzet';
  const d = new Date(until);
  const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `tot ${time}` : `tot morgen ${time}`;
}

Object.assign(module.exports, { isOn, set, apply, applyToView, label });
