// Licht of donker thema. "Systeem" volgt Ubuntu (Instellingen → Uiterlijk).
// De schermen van Tabchat kiezen hun kleuren via prefers-color-scheme (renderer/theme.css);
// diensten als WhatsApp en Teams volgen dezelfde keuze, maar pas na opnieuw laden.
const { nativeTheme } = require('electron');
const store = require('./store');

let dark = null;            // huidige stand, om echte wissels te herkennen
const pending = new Set();  // tabbladen die nog opnieuw geladen moeten worden

function background() {
  return nativeTheme.shouldUseDarkColors ? '#1e1f22' : '#ffffff';
}

function apply() {
  nativeTheme.themeSource = store.config.settings.theme || 'system';
  if (store.win) store.win.setBackgroundColor(background());
}

// Diensten opnieuw laden zodat ze het nieuwe thema oppakken.
// Het tabblad dat je nu gebruikt laden we pas als je wegklikt (bv. niet midden in een gesprek).
function reloadServices() {
  const views = require('./views');
  const visible = store.win && store.win.isVisible();
  for (const id of Object.keys(store.views)) {
    if (visible && id === store.active) pending.add(id);
    else views.reloadView(id);
  }
}

// Aangeroepen als je van tabblad wisselt of het venster verbergt
function flush(exceptId) {
  for (const id of [...pending]) {
    if (id === exceptId) continue;
    pending.delete(id);
    require('./views').reloadView(id);
  }
}

nativeTheme.on('updated', () => {
  if (store.win) store.win.setBackgroundColor(background());
  const now = nativeTheme.shouldUseDarkColors;
  if (dark !== null && now !== dark) reloadServices();
  dark = now;
});

function init() {
  dark = nativeTheme.shouldUseDarkColors;
  if (store.win) store.win.on('hide', () => flush(null));
}

module.exports = { apply, background, init, flush };
