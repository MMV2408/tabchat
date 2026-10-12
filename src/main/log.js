// Small log files in the app's config folder (~/.config/tabchat/<name>.log).
// Errors we can recover from are written here instead of being silently ignored,
// so a user can send the file along when something doesn't work.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX_SIZE = 256 * 1024; // above this the file is rotated to <name>.log.old

function write(name, level, parts) {
  try {
    const file = path.join(app.getPath('userData'), name + '.log');
    try {
      if (fs.statSync(file).size > MAX_SIZE) fs.renameSync(file, file + '.old');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e; // no file yet is fine
    }
    const text = parts.map(x => (x instanceof Error ? x.stack || x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    fs.appendFileSync(file, `${new Date().toISOString()} ${app.getVersion()} [${level}] ${text}\n`);
  } catch (e) {
    // Logging must never break the app; the console is the last resort
    console.error('log write failed:', e && e.message, ...parts);
  }
}

function create(name) {
  return {
    info: (...a) => write(name, 'info', a),
    warn: (...a) => write(name, 'warn', a),
    error: (...a) => write(name, 'error', a)
  };
}

module.exports = { create, ...create('tabchat') };
