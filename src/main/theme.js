// Licht of donker thema. "Systeem" volgt Ubuntu (Instellingen → Uiterlijk).
// De schermen van Tabchat kiezen hun kleuren via prefers-color-scheme (renderer/theme.css);
// diensten als WhatsApp en Discord volgen dezelfde keuze.
const { nativeTheme } = require('electron');
const store = require('./store');

function background() {
  return nativeTheme.shouldUseDarkColors ? '#1e1f22' : '#ffffff';
}

function apply() {
  nativeTheme.themeSource = store.config.settings.theme || 'system';
  if (store.win) store.win.setBackgroundColor(background());
}

nativeTheme.on('updated', () => { if (store.win) store.win.setBackgroundColor(background()); });

module.exports = { apply, background };
