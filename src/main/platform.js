// How Tabchat was installed. With Flathub and the Snap Store the store handles
// updates and start-at-login works differently, so we hide those options there.
// The AUR package (Arch Linux) writes "aur" into resources/package-type, so Tabchat knows that
// pacman/yay installs the updates there and doesn't try to install a .deb itself.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function packageType() {
  try {
    return fs.readFileSync(path.join(process.resourcesPath, 'package-type'), 'utf8').trim();
  } catch (e) {
    return ''; // not packaged, or an older build without the file
  }
}

const kind = (process.env.FLATPAK_ID || fs.existsSync('/.flatpak-info')) ? 'flatpak'
  : process.env.SNAP ? 'snap'
  : process.env.APPIMAGE ? 'appimage'
  : app.isPackaged && packageType() === 'aur' ? 'aur'
  : app.isPackaged ? 'deb'
  : 'dev';

// Sandboxed stores: they also handle autostart, links and Do not disturb differently
const storeManaged = kind === 'flatpak' || kind === 'snap';
// Someone else installs the updates (the store, or pacman for the AUR)
const externalUpdates = storeManaged || kind === 'aur';
const storeName = kind === 'flatpak' ? 'Flathub' : kind === 'snap' ? 'Snap Store' : kind === 'aur' ? 'AUR' : null;

module.exports = { kind, storeManaged, externalUpdates, storeName };
