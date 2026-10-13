// Memory per tab for the + screen. Same method as tools/memstat.js:
// PSS from the kernel, so memory that processes share is divided fairly and nothing counts twice.
// Only measured while the + screen asks for it (every few seconds while it's open).
const { app } = require('electron');
const fs = require('fs');
const store = require('./store');

// PSS (+ swapped-out part) of one process in KB, or null when it can't be read (sandbox in a dev build)
function pssKb(pid) {
  try {
    const s = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
    const kb = (k) => +((s.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm')) || [])[1] || 0);
    return kb('Pss') + kb('SwapPss');
  } catch (e) {
    return null;
  }
}

// All OS process ids used by a view: its page plus iframes from other sites (own processes)
function pidsOf(view) {
  const wc = view && view.webContents;
  if (!wc || wc.isDestroyed()) return [];
  const pids = new Set([wc.getOSProcessId()]);
  try {
    for (const f of wc.mainFrame.framesInSubtree) if (f.osProcessId) pids.add(f.osProcessId);
  } catch (e) {
    // frame went away while we looked: the main pid is enough
  }
  return [...pids].filter(Boolean);
}

// Every process of the app: all descendants of the main process (also zygotes and helpers
// that app.getAppMetrics() leaves out), same as tools/memstat.js
function processTree() {
  const parent = {};
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
      parent[d] = st.slice(st.lastIndexOf(')') + 2).split(' ')[1];
    } catch (e) {
      // process ended while we looked
    }
  }
  const out = [String(process.pid)];
  for (let i = 0; i < out.length; i++) {
    for (const [pid, pp] of Object.entries(parent)) if (pp === out[i]) out.push(pid);
  }
  return out.map(Number);
}

function stats() {
  if (!store.alive() || store.active !== 'home') return null;
  let exact = true;
  const size = {};
  for (const pid of processTree()) {
    const kb = pssKb(pid);
    if (kb === null) exact = false;
    size[pid] = kb || 0;
  }
  // Some processes can't be read (setuid sandbox, mostly in a dev build): rather no numbers
  // than wrong ones (the RSS fallback counted shared memory twice)
  if (!exact) return { exact: false };
  const metrics = app.getAppMetrics();

  // Which processes belong to which tab (duplicated tabs can share one: split evenly)
  const owners = {};
  for (const tab of store.config.tabs) {
    for (const pid of pidsOf(store.views[tab.id])) (owners[pid] = owners[pid] || []).push(tab.id);
  }
  const tabs = {};
  let tabKb = 0;
  for (const [pid, ids] of Object.entries(owners)) {
    const kb = size[pid] || 0;
    tabKb += kb;
    for (const id of ids) tabs[id] = (tabs[id] || 0) + kb / ids.length;
  }
  for (const id in tabs) tabs[id] = Math.round(tabs[id] / 1024);

  // Renderers that are neither a tab nor one of our own screens: background work of sites (service workers)
  const own = new Set();
  for (const v of [store.bar, store.home, store.palette, store.share, store.find, require('./split').dividerView()]) {
    for (const pid of pidsOf(v)) own.add(pid);
  }
  let backgroundKb = 0;
  for (const m of metrics) {
    if (m.type === 'Tab' && !owners[m.pid] && !own.has(m.pid)) backgroundKb += size[m.pid] || 0;
  }

  const totalKb = Object.values(size).reduce((a, b) => a + b, 0);
  return {
    tabs,
    background: Math.round(backgroundKb / 1024),
    self: Math.round((totalKb - tabKb - backgroundKb) / 1024),
    total: Math.round(totalKb / 1024),
    exact
  };
}

module.exports = { stats };
