// Downloads from a service (a PDF from Brightspace, a photo from WhatsApp, ...):
// saved straight to your Downloads folder, shown with progress in the tab bar (⬇) and listed
// on the + screen (last 20, with Open and Show in folder). PDFs open in Tabchat's own viewer.
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const config = require('./config');
const { t } = require('./i18n');
const log = require('./log');

const MAX = 20;
const watched = new WeakSet(); // sessions that already have the handler
const active = new Map();      // id -> { id, name, file, size, received, state: 'progress', time }
let nextId = Date.now();
let unseen = 0;                // finished downloads you haven't looked at yet (for the ⬇ in the bar)
let redraw = null;

// "report.pdf" exists? Then "report (1).pdf", "report (2).pdf", ...
function freePath(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext) || 'download';
  let file = path.join(dir, base + ext);
  for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${base} (${n})${ext}`);
  return file;
}

function saved() {
  if (!Array.isArray(store.config.downloads)) store.config.downloads = [];
  return store.config.downloads;
}

// Tell the screens, at most a few times per second while something downloads
function changed(now) {
  if (now) { clearTimeout(redraw); redraw = null; return require('./views').broadcast(); }
  if (redraw) return;
  redraw = setTimeout(() => { redraw = null; require('./views').broadcast(); }, 400);
}

const isPdf = (file) => path.extname(file).toLowerCase() === '.pdf';

function finish(entry, state) {
  active.delete(entry.id);
  if (state === 'cancelled') return changed(true);
  entry.state = state === 'completed' ? 'completed' : 'failed';
  const list = saved();
  list.unshift(entry);
  list.length = Math.min(list.length, MAX);
  config.save();
  unseen++;
  changed(true);

  const notify = require('./notify').notify;
  const name = path.basename(entry.file);
  if (entry.state === 'completed') {
    const pdfHere = isPdf(entry.file) && store.config.settings.pdfInTabchat !== false;
    if (pdfHere) require('./pdf').open(entry.file);
    else notify({ title: t('dl.done', { name }), body: t('dl.body'), onClick: () => shell.showItemInFolder(entry.file) });
  } else {
    notify({ title: t('dl.failed', { name }), body: t('dl.failedBody') });
  }
}

function watch(ses) {
  if (watched.has(ses)) return;
  watched.add(ses);
  ses.on('will-download', (_e, item) => {
    const file = freePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(file); // no save dialog
    const entry = { id: String(nextId++), name: path.basename(file), file, size: item.getTotalBytes(), received: 0, state: 'progress', time: Date.now() };
    active.set(entry.id, entry);
    changed(true);
    item.on('updated', () => {
      entry.received = item.getReceivedBytes();
      entry.size = item.getTotalBytes() || entry.size;
      changed(false);
    });
    item.once('done', (_ev, state) => {
      entry.received = item.getReceivedBytes();
      if (state !== 'completed' && state !== 'cancelled') log.warn('download failed:', item.getURL(), state);
      finish(entry, state);
    });
  });
}

// ---------- for the screens ----------
function find(id) {
  return active.get(id) || saved().find(d => d.id === id);
}

function state() {
  const items = [...active.values(), ...saved()].map(d => ({
    id: d.id, name: d.name, size: d.size, received: d.received, state: d.state, time: d.time,
    missing: d.state === 'completed' && !fs.existsSync(d.file)
  }));
  let size = 0, received = 0;
  for (const d of active.values()) { size += d.size || 0; received += d.received || 0; }
  return {
    items,
    active: active.size,
    percent: active.size && size ? Math.floor((received / size) * 100) : null,
    unseen
  };
}

function open(id) {
  const d = find(id);
  if (!d || d.state !== 'completed') return;
  if (!fs.existsSync(d.file)) return changed(true);
  if (isPdf(d.file) && store.config.settings.pdfInTabchat !== false) require('./pdf').open(d.file);
  else shell.openPath(d.file).then(err => { if (err) log.warn('open download:', err); });
}

function showInFolder(id) {
  const d = find(id);
  if (d) shell.showItemInFolder(d.file);
}

function clear() {
  store.config.downloads = [];
  config.save();
  unseen = 0;
  changed(true);
}

// You opened the list: the ⬇ in the bar goes away (unless something is still downloading)
function seen() {
  if (!unseen) return;
  unseen = 0;
  changed(true);
}

module.exports = { watch, state, open, showInFolder, clear, seen };
