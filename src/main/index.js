// Startpunt van Tabchat.
// Hier gebeurt bijna niets: de echte code staat in de andere bestanden in deze map.
const { app } = require('electron');
const window = require('./window');
const ipc = require('./ipc');
const actions = require('./actions');

// Minder geheugen voor JavaScript per tabblad
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// Maar één Tabchat tegelijk. Start je hem nog een keer terwijl hij op de
// achtergrond draait, dan komt het bestaande venster tevoorschijn.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => require('./tray').showWindow());

  ipc.register();

  app.whenReady().then(window.create);
  // Bij elk afsluiten (ook uitloggen of afsluiten van de computer)
  app.on('before-quit', () => {
    require('./store').quitting = true;
    require('./tray').destroy();
  });
  app.on('window-all-closed', actions.quit);
}
