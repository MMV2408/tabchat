// Hoe Tabchat geïnstalleerd is. Bij Flathub en de Snap Store regelt de winkel
// de updates, en werkt starten bij inloggen anders; die opties verbergen we dan.
const { app } = require('electron');
const fs = require('fs');

const kind = (process.env.FLATPAK_ID || fs.existsSync('/.flatpak-info')) ? 'flatpak'
  : process.env.SNAP ? 'snap'
  : process.env.APPIMAGE ? 'appimage'
  : app.isPackaged ? 'deb'
  : 'dev';

const storeManaged = kind === 'flatpak' || kind === 'snap';
const storeName = kind === 'flatpak' ? 'Flathub' : kind === 'snap' ? 'Snap Store' : null;

module.exports = { kind, storeManaged, storeName };
