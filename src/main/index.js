// Startpunt van Tabchat.
// Hier gebeurt bijna niets: de echte code staat in de andere bestanden in deze map.
const { app } = require('electron');
const window = require('./window');
const ipc = require('./ipc');
const actions = require('./actions');

// Minder geheugen voor JavaScript per tabblad
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

ipc.register();

app.whenReady().then(window.create);
app.on('window-all-closed', actions.quit);
