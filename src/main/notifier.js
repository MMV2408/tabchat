// Meldingen via Ubuntu zelf (het meldingssysteem van de desktop, via D-Bus).
//
// Electron-meldingen (en meldingen die Tabchat zelf stuurt) laten de muis na een klik
// ~15 seconden laden: GNOME koppelt de melding aan Tabchat en "start" de app bij een klik.
// Daarom stuurt een klein hulpprogramma zonder venster de meldingen (notify-helper.js):
// GNOME koppelt ze dan aan geen enkele app en start niets. De klik komt via het
// hulpprogramma bij ons binnen en dan halen we zelf het venster en het juiste tabblad naar voren.
//
// Lukt dat niet, of in Flathub/Snap, dan gebruikt Tabchat gewoon de meldingen van Electron.
const { nativeImage, Notification } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const platform = require('./platform');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const TMP = path.join(os.tmpdir(), 'tabchat-notify-' + process.getuid());

let child = null;
let available = null;
let nextKey = 1;
const pending = new Map(); // key -> { opts, file, cb }
const items = new Map();   // D-Bus-id -> { onClick, onClose, file }

function isAvailable() {
  if (available !== null) return available;
  available = false;
  if (platform.storeManaged || process.platform !== 'linux' || !process.env.DBUS_SESSION_BUS_ADDRESS) return available;
  try {
    child = fork(path.join(__dirname, 'notify-helper.js'), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    child.on('message', onMessage);
    child.on('exit', () => {
      available = false; child = null;
      for (const p of pending.values()) failed(p); // nog niet getoond: alsnog via Electron
      pending.clear();
    });
    child.on('error', () => {});
    available = true;
  } catch { available = false; child = null; }
  return available;
}

function onMessage(m) {
  if (m.type === 'shown') {
    const p = pending.get(m.key);
    if (!p) return;
    pending.delete(m.key);
    if (!m.id) return failed(p);
    items.set(m.id, { onClick: p.opts.onClick, onClose: p.opts.onClose, file: p.file });
    if (p.cb) p.cb(m.id);
  } else if (m.type === 'click') {
    runClick(m.id);
  } else if (m.type === 'closed') {
    forget(m.id, true); // klik komt altijd vóór het sluiten binnen, dus dit is wegklikken of verlopen
  }
}

function failed(p) {
  if (p.file) fs.rm(p.file, { force: true }, () => {});
  fallback(p.opts);
  if (p.cb) p.cb(null);
}

function forget(id, notifyClose) {
  const it = items.get(id);
  if (!it) return;
  items.delete(id);
  if (it.file) fs.rm(it.file, { force: true }, () => {});
  if (notifyClose && it.onClose) it.onClose();
}

function runClick(id) {
  const it = items.get(id);
  if (!it) return;
  forget(id, false);
  if (it.onClick) it.onClick();
}

// Oud (van een eerdere aanpak); laten staan zodat index.js niet hoeft te veranderen
function handleArgv() { return false; }

// ---------- tonen ----------
const markup = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Terugval: gewone Electron-melding
function fallback({ title, body, onClick }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON });
  n.on('click', () => onClick && onClick());
  n.show();
}

// image: data-URL (mag leeg zijn). cb(id) met het D-Bus-id, of null.
function show(opts, cb) {
  const { title, body, image, onClick, onClose } = opts;
  if (!isAvailable()) { fallback(opts); return cb && cb(null); }
  let file = '';
  try {
    if (image && image.startsWith('data:')) {
      const img = nativeImage.createFromDataURL(image);
      if (!img.isEmpty()) {
        fs.mkdirSync(TMP, { recursive: true, mode: 0o700 });
        file = path.join(TMP, `${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
        fs.writeFileSync(file, img.toPNG());
      }
    }
  } catch { file = ''; }
  const key = nextKey++;
  pending.set(key, { opts, file, cb });
  try {
    child.send({ type: 'show', key, icon: 'tabchat', title: String(title ?? ''), body: markup(body), image: file });
  } catch { pending.delete(key); failed({ opts, file, cb }); }
}

function close(id) {
  if (!items.has(id) || !child) return;
  try { child.send({ type: 'close', id }); } catch {}
  forget(id, false);
}

module.exports = { isAvailable, show, close, handleArgv };
