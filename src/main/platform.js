// How Tabchat was installed. With Flathub and the Snap Store the store handles
// updates and start-at-login works differently, so we hide those options there.
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
