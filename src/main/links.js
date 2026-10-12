// Open links from WhatsApp, Outlook, Teams etc.: in your default browser,
// in a chosen browser (Firefox, Chrome, ...) or in a Tabchat window.
const { BrowserWindow, shell, app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const platform = require('./platform');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

// Known browsers and their .desktop files (regular, Snap and Flatpak)
const KNOWN = [
  ['firefox', 'Firefox', ['firefox.desktop', 'firefox_firefox.desktop', 'org.mozilla.firefox.desktop']],
  ['chrome', 'Google Chrome', ['google-chrome.desktop', 'com.google.Chrome.desktop']],
  ['chromium', 'Chromium', ['chromium.desktop', 'chromium_chromium.desktop', 'chromium-browser.desktop', 'org.chromium.Chromium.desktop']],
  ['brave', 'Brave', ['brave-browser.desktop', 'brave_brave.desktop', 'com.brave.Browser.desktop']],
  ['edge', 'Microsoft Edge', ['microsoft-edge.desktop', 'com.microsoft.Edge.desktop']],
  ['vivaldi', 'Vivaldi', ['vivaldi-stable.desktop', 'com.vivaldi.Vivaldi.desktop']],
  ['opera', 'Opera', ['opera.desktop', 'opera_opera.desktop', 'com.opera.Opera.desktop']],
  ['librewolf', 'LibreWolf', ['librewolf.desktop', 'io.gitlab.librewolf-community.desktop']],
  ['zen', 'Zen', ['zen.desktop', 'app.zen_browser.zen.desktop']]
];

function dirs() {
  const home = app.getPath('home');
  return [
    path.join(home, '.local/share/applications'),
    '/usr/share/applications',
    '/usr/local/share/applications',
    '/var/lib/snapd/desktop/applications',
    '/var/lib/flatpak/exports/share/applications',
    path.join(home, '.local/share/flatpak/exports/share/applications')
  ];
}

// Which browsers are installed? (We can't see that inside Flathub/Snap.)
let cache = null;
function browsers() {
  if (platform.storeManaged) return [];
  if (cache) return cache;
  cache = [];
  for (const [id, name, files] of KNOWN) {
    let found = null;
    for (const d of dirs()) {
      for (const f of files) {
        const p = path.join(d, f);
        if (!found && fs.existsSync(p)) found = p;
      }
    }
    if (found) cache.push({ id, name, file: found });
  }
  return cache;
}

// ---------- inside Tabchat ----------
function openInternal(url, ses) {
  const w = new BrowserWindow({
    width: 1100,
    height: 800,
    autoHideMenuBar: true,
    icon: ICON,
    webPreferences: { session: ses } // same login as the tab (e.g. SharePoint from Teams)
  });
  w.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/.test(u)) w.loadURL(u); // links in this window stay in this window
    return { action: 'deny' };
  });
  w.loadURL(url);
}

// ---------- open according to the setting ----------
function open(url, ses) {
  if (!/^https?:/.test(url)) return;
  const choice = store.config.settings.openLinks || 'default';
  if (choice === 'internal' && ses) return openInternal(url, ses);
  const b = browsers().find(x => x.id === choice);
  if (b) {
    // gio starts the browser like the app menu does; if that fails, the default browser
    return execFile('gio', ['launch', b.file, url], (err) => { if (err) shell.openExternal(url); });
  }
  shell.openExternal(url);
}

// Some services (Outlook) first open an empty window and only then set its address.
// We catch that empty window: once the real address is known, we open it and close the window.
function catchBlank(child, ses) {
  let done = false;
  const handle = (target) => {
    if (done || !target || !/^https?:/.test(target)) return;
    done = true;
    open(target, ses);
    setImmediate(() => { if (!child.isDestroyed()) child.close(); });
  };
  child.webContents.on('will-navigate', (e, u) => { e.preventDefault(); handle(u); });
  child.webContents.on('did-start-navigation', (e, u) => handle(typeof u === 'string' ? u : e && e.url));
  setTimeout(() => { if (!done && !child.isDestroyed()) child.close(); }, 15000);
}

module.exports = { browsers, open, catchBlank };
