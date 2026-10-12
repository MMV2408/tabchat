// Startpunt van Tabchat.
// Hier gebeurt bijna niets: de echte code staat in de andere bestanden in deze map.
const { app } = require('electron');
const window = require('./window');
const ipc = require('./ipc');
const actions = require('./actions');

// Minder geheugen voor JavaScript per tabblad
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// Hardwareversnelling uit (instelling in het +-scherm → Algemeen): helpt bij beeldproblemen
// (zwart scherm, flikkeren), vooral met NVIDIA of Wayland. Scheelt nauwelijks geheugen. Moet vóór het starten.
const hwAccel = require('./config').peekSetting('hardwareAcceleration') !== false;
require('./store').hwAtStart = hwAccel;
if (!hwAccel) app.disableHardwareAcceleration();

// Vangnet: een onverwachte fout komt in een logbestand in plaats van in een foutvenster.
// Zo ziet een gebruiker nooit "A JavaScript error occurred", en kunnen we het toch terugvinden.
function logError(err) {
  try {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(app.getPath('userData'), 'error.log');
    const line = `${new Date().toISOString()} ${app.getVersion()} ${(err && err.stack) || err}\n`;
    fs.appendFileSync(file, line);
  } catch {}
  console.error(err);
}
process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

// Maar één Tabchat tegelijk. Start je hem nog een keer terwijl hij op de
// achtergrond draait, dan komt het bestaande venster tevoorschijn.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    // Klik op een melding (zie notifier.js): het venster is dan al naar voren gehaald
    if (require('./notifier').handleArgv(argv)) return;
    require('./tray').showWindow();
  });

  ipc.register();

  app.whenReady().then(() => { window.create(); require('./icons').start(); });
  // Bij elk afsluiten (ook uitloggen of afsluiten van de computer)
  app.on('before-quit', () => {
    require('./store').quitting = true;
    require('./tray').destroy();
  });
  app.on('window-all-closed', actions.quit);
}
