// Notifications via Ubuntu itself (the desktop's notification system, via D-Bus).
//
// Electron notifications (and ones Tabchat sends itself) show a loading cursor for ~15 seconds
// after a click: GNOME links the notification to Tabchat and "starts" the app on a click.
// That's why a small helper without a window sends the notifications: the native tabchat-helper
// (Rust, see helper/, ~2 MB), or notify-helper.js (Node, ~30 MB) when that program isn't there:
// GNOME then links them to no app at all and starts nothing. The click reaches us via the
// helper, and we bring the window and the right tab to the front ourselves.
//
// If that fails, or in Flathub, Tabchat simply uses Electron's notifications.
const { nativeImage, Notification } = require('electron');
const { fork, spawn } = require('child_process');
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

// The native helper: next to the app when installed, or helper/target/release in a dev build
function nativeHelper() {
  const spots = [
    process.resourcesPath && path.join(process.resourcesPath, 'helper', 'tabchat-helper'),
    path.join(__dirname, '..', '..', 'helper', 'target', 'release', 'tabchat-helper')
  ];
  for (const f of spots) {
    try { if (f) { fs.accessSync(f, fs.constants.X_OK); return f; } } catch (e) { /* not here, try the next spot */ }
  }
  return null;
}
let useNative = true; // false after the native helper failed once: use the Node helper from then on

// Messages to the helper: JSON lines to the native one, IPC to the Node one
function post(m) {
  if (child.stdin) child.stdin.write(JSON.stringify(m) + '\n');
  else child.send(m);
}

function spawnNative(file) {
  const c = spawn(file, [], { stdio: ['pipe', 'pipe', 'ignore'] });
  c.stdin.on('error', (e) => log.warn('native helper stdin:', e));
  let buf = '';
  c.stdout.setEncoding('utf8');
  c.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      try { onMessage(JSON.parse(line)); } catch (e) { log.warn('native helper message:', e); }
    }
  });
  return c;
}

let stopping = false;
function start() {
  if (child) return true;
  try {
    stopping = false;
    const file = useNative && nativeHelper();
    if (file) {
      child = spawnNative(file);
    } else {
      child = fork(path.join(__dirname, 'notify-helper.js'), [], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc']
      });
      child.on('message', onMessage);
    }
    const native = !!file;
    const me = child;
    let ended = false;
    const onEnd = (code) => {
      if (ended) return;
      ended = true;
      if (native && !stopping) {
        // Native helper stopped unexpectedly: try the Node helper next time instead of giving up
        log.warn('native helper exited with', code, '- using the Node helper');
        useNative = false;
      } else if (!stopping) available = false; // stopped unexpectedly: continue via Electron
      if (child === me) child = null;
      for (const p of pending.values()) failed(p); // not shown yet: show via Electron instead
      pending.clear();
      items.clear();
    };
    child.on('exit', onEnd);
    child.on('error', (e) => {
      // Could not start (e.g. the program is missing): use the Node helper next time
      log.warn('notify helper error:', e);
      if (native) useNative = false;
      if (child === me && me.exitCode === null && !me.pid) onEnd(null); // never started, so no 'exit' follows
    });
    return true;
  } catch { available = false; child = null; return false; }
}

// No notifications open anymore? Then stop the helper after 10 minutes (saves ~2 MB native, ~30 MB Node)
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
    post({ type: 'show', key, icon: 'tabchat', title: String(title ?? ''), body: markup(body), image: file });
  } catch { pending.delete(key); failed({ opts, file, cb }); }
}

function close(id) {
  if (!items.has(id) || !child) return;
  try { post({ type: 'close', id }); } catch (e) { log.warn('notify helper close:', e); }
  forget(id, false);
}

module.exports = { isAvailable, show, close, handleArgv };
