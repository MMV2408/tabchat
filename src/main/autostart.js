// Start automatically at login.
// On Linux this is done with a .desktop file in ~/.config/autostart/.
// Tabchat then starts with "--hidden": hidden in the tray right away.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const platform = require('./platform');

const configDir = process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config');
const FILE = path.join(configDir, 'autostart', 'tabchat.desktop');

const startedHidden = process.argv.includes('--hidden');

// How Tabchat should be started (installed, AppImage or during development)
function command() {
  if (process.env.APPIMAGE) return `"${process.env.APPIMAGE}" --hidden`;
  if (app.isPackaged) return `"${process.execPath}" --hidden`;
  return `"${process.execPath}" "${app.getAppPath()}" --hidden`;
}

function desktopFile() {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Tabchat',
    'Comment=Tabchat verborgen starten in de tray',
    `Exec=${command()}`,
    'Icon=tabchat',
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    'X-GNOME-Autostart-Delay=5', // wait a moment until the top bar is ready
    ''
  ].join('\n');
}

// Create or remove the file, according to the setting.
// Also on every start, so the path is right after an update.
function sync() {
  if (platform.storeManaged) return; // ~/.config/autostart can't be reached there
  try {
    if (store.config.settings.autostart) {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, desktopFile());
    } else if (fs.existsSync(FILE)) {
      fs.unlinkSync(FILE);
    }
  } catch (err) {
    require('./log').warn('setting up autostart failed:', err);
  }
}

module.exports = { sync, startedHidden };
