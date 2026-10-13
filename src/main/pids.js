// Only active when started with TABCHAT_PIDS=1 (for tools/memstat.js).
// Writes which process shows which page to ~/.config/tabchat/pids.json,
// so the memory measurement can name each renderer instead of just "renderer".
const { app, webContents } = require('electron');
const fs = require('fs');
const path = require('path');

function label(wc) {
  const url = wc.getURL();
  if (url.startsWith('file:')) return path.basename(url.split(/[?#]/)[0], '.html');
  try { return new URL(url).hostname || url; } catch (e) { return url || '?'; }
}

function write() {
  const map = { main: process.pid, renderers: {} };
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed()) continue;
    const pid = wc.getOSProcessId();
    if (!pid) continue;
    (map.renderers[pid] = map.renderers[pid] || []).push(label(wc));
  }
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'pids.json'), JSON.stringify(map));
  } catch (e) {
    require('./log').warn('pids.json:', e);
  }
}

function start() {
  write();
  setInterval(write, 3000);
}

module.exports = { start };
