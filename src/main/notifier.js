// Notifications via Ubuntu itself (the desktop's notification system, via D-Bus).
//
// Electron notifications (and ones Tabchat sends itself) show a loading cursor for ~15 seconds
// after a click: GNOME links the notification to Tabchat and "starts" the app on a click.
// That's why a small helper without a window sends the notifications (notify-helper.js):
// GNOME then links them to no app at all and starts nothing. The click reaches us via the
// helper, and we bring the window and the right tab to the front ourselves.
//
// If that fails, or in Flathub, Tabchat simply uses Electron's notifications.
const { nativeImage, Notification } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const platform = require('./platform');
const log = require('./log');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const TMP = path.join(os.tmpdir(), 'tabchat-notify-' + process.getuid());

let child = null;
let available = null;
let nextKey = 1;
const pending = new Map(); // key -> { opts, file, cb }
const items = new Map();   // D-Bus id -> { onClick, onClose, file }

// Can we use Ubuntu? (doesn't start the helper yet: that only happens on the first notification)
function isAvailable() {
  if (available !== null) return available;
  available = platform.kind !== 'flatpak' && process.platform === 'linux' && !!process.env.DBUS_SESSION_BUS_ADDRESS;
  return available;
}

let stopping = false;
function start() {
  if (child) return true;
  try {
    stopping = false;
    child = fork(path.join(__dirname, 'notify-helper.js'), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    child.on('message', onMessage);
    child.on('exit', () => {
      if (!stopping) available = false; // stopped unexpectedly: continue via Electron
      child = null;
      for (const p of pending.values()) failed(p); // not shown yet: show via Electron instead
      pending.clear();
      items.clear();
    });
    child.on('error', () => {});
    return true;
  } catch { available = false; child = null; return false; }
}

// No notifications open anymore? Then stop the helper after 10 minutes (saves ~90 MB)
const IDLE = 10 * 60 * 1000;
let idleTimer = null;
function idleCheck() {
  clearTimeout(idleTimer);
  idleTimer = null;
  if (!child || pending.size || items.size) return;
  idleTimer = setTimeout(() => {
    if (!child || pending.size || items.size) return;
    stopping = true;
    try { child.kill(); } catch (e) { log.warn('notify helper stop:', e); }
  }, IDLE);
}

function onMessage(m) {
  if (m.type === 'shown') {
    const p = pending.get(m.key);
    if (!p) return;
    pending.delete(m.key);
    if (!m.id) { failed(p); return idleCheck(); }
    items.set(m.id, { onClick: p.opts.onClick, onClose: p.opts.onClose, file: p.file });
    if (p.cb) p.cb(m.id);
  } else if (m.type === 'click') {
    runClick(m.id);
  } else if (m.type === 'log') {
    log.warn('notify helper:', m.text);
  } else if (m.type === 'closed') {
    forget(m.id, true); // a click always arrives before the close, so this is a dismiss or a timeout
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
  idleCheck();
}

function runClick(id) {
  const it = items.get(id);
  if (!it) return;
  forget(id, false);
  if (it.onClick) it.onClick();
}

// Old (from an earlier approach); kept so index.js doesn't have to change
function handleArgv() { return false; }

const markup = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Fallback: a regular Electron notification
function fallback({ title, body, onClick }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON });
  n.on('click', () => onClick && onClick());
  n.show();
}

// image: data URL (may be empty). cb(id) with the D-Bus id, or null.
function show(opts, cb) {
  const { title, body, image, onClick, onClose } = opts;
  if (!isAvailable() || !start()) { fallback(opts); return cb && cb(null); }
  clearTimeout(idleTimer);
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
  try { child.send({ type: 'close', id }); } catch (e) { log.warn('notify helper close:', e); }
  forget(id, false);
}

module.exports = { isAvailable, show, close, handleArgv };
