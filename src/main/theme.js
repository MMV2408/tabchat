// Light or dark theme. "System" follows Ubuntu (Settings → Appearance).
// Tabchat's own screens pick their colors via prefers-color-scheme (renderer/theme.css);
// services like WhatsApp and Teams follow the same choice, but only after a reload.
const { nativeTheme } = require('electron');
const store = require('./store');

let dark = null;            // current mode, to detect real changes
const pending = new Set();  // tabs that still need a reload

function background() {
  return nativeTheme.shouldUseDarkColors ? '#1e1f22' : '#ffffff';
}

function apply() {
  nativeTheme.themeSource = store.config.settings.theme || 'system';
  if (store.win) store.win.setBackgroundColor(background());
}

// Reload services so they pick up the new theme.
// The tab you're using is only reloaded once you leave it (e.g. not in the middle of a call).
function reloadServices() {
  const views = require('./views');
  const visible = store.win && store.win.isVisible();
  for (const id of Object.keys(store.views)) {
    if (visible && id === store.active) pending.add(id);
    else views.reloadView(id);
  }
}

// Called when you switch tabs or hide the window
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
