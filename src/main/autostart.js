// Automatisch starten bij inloggen.
// Op Linux gaat dat via een .desktop-bestand in ~/.config/autostart/.
// Tabchat start dan met "--hidden": meteen verborgen in de tray.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const platform = require('./platform');

const configDir = process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config');
const FILE = path.join(configDir, 'autostart', 'tabchat.desktop');

// Is deze keer gestart via autostart?
const startedHidden = process.argv.includes('--hidden');

// Hoe Tabchat gestart moet worden (geïnstalleerd, AppImage of tijdens testen)
function command() {
  if (process.env.APPIMAGE) return `"${process.env.APPIMAGE}" --hidden`;
  if (app.isPackaged) return `"${process.execPath}" --hidden`;
  return `"${process.execPath}" "${app.getAppPath()}" --hidden`; // npm start
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
    'X-GNOME-Autostart-Delay=5', // even wachten tot de balk bovenin klaar is
    ''
  ].join('\n');
}

// Bestand aanmaken of weghalen, volgens de instelling.
// Ook bij elke start, zodat het pad klopt na een update.
function sync() {
  if (platform.storeManaged) return; // map ~/.config/autostart is daar niet bereikbaar
  try {
    if (store.config.settings.autostart) {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, desktopFile());
    } else if (fs.existsSync(FILE)) {
      fs.unlinkSync(FILE);
    }
  } catch (err) {
    console.error('Kon automatisch starten niet instellen:', err);
  }
}

module.exports = { sync, startedHidden };
