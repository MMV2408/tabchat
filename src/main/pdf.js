// PDFs open in a small Tabchat window with Chromium's built-in PDF viewer
// (zoom, search, print, save), instead of only landing in your Downloads folder.
// Setting "Open PDFs in Tabchat" off: they just download, like other files.
const { BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const log = require('./log');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

function open(file) {
  const win = new BrowserWindow({
    width: 1000,
    height: 820,
    title: path.basename(file),
    icon: ICON,
    autoHideMenuBar: true,
    backgroundColor: '#525659', // the PDF viewer's own grey, no white flash
    webPreferences: { plugins: true, sandbox: true, contextIsolation: true }
  });
  win.setMenu(null);
  // The viewer may only show this file: links in the PDF open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); require('electron').shell.openExternal(url); }
  });
  win.on('page-title-updated', (e) => e.preventDefault()); // keep the file name as the title
  win.loadURL(pathToFileURL(file).href).catch(e => log.warn('pdf open:', e));
  return win;
}

module.exports = { open };
