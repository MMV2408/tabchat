// Tab sleep.
// A tab you haven't looked at for a while is removed from memory.
// Click it and it loads again (you stay signed in).
// Note: a sleeping tab gets no notifications and no counters.
const store = require('./store');
const config = require('./config');
const views = require('./views');
const microsoft = require('./microsoft');
const { CATALOG } = require('./catalog');

const asleep = new Set();   // tabs that are asleep now
const lastSeen = {};        // tab id -> when you last looked at it
const started = Date.now();
let timer = null;

// May this tab sleep? The user's own choice wins,
// otherwise the service default (chat apps stay awake, see catalog.js).
function canSleep(tab) {
  if (typeof tab.noSleep === 'boolean') return !tab.noSleep;
  return !CATALOG[tab.service].awake;
}

function isAsleep(id) {
  return asleep.has(id);
}

function seen(id) {
  if (id && id !== 'home') lastSeen[id] = Date.now();
}

// Put to sleep. Never: the tab you're viewing, a tab playing sound
// (e.g. a call) or a Microsoft tab still waiting to sign in.
function sleep(id) {
  const v = store.views[id];
  if (!v || require('./split').visible(id)) return false;
  if (v.webContents.isCurrentlyAudible()) return false;
  if (microsoft.waiting.has(id)) return false;
  asleep.add(id);
  views.removeForSleep(id);
  views.broadcast();
  return true;
}

// Wake up (happens by itself when you open the tab, see views.show)
function wake(id) {
  if (!asleep.delete(id)) return;
  const tab = store.config.tabs.find(t => t.id === id);
  if (tab) views.createServiceView(tab);
}

// On startup: mark a tab as asleep right away (it isn't loaded then)
function startAsleep(id) {
  asleep.add(id);
}

// Start asleep? Only if tab sleep is on and the tab may sleep
function shouldStartAsleep(tab) {
  const s = store.config.settings;
  return s.sleepEnabled && s.sleepOnStart && canSleep(tab);
}

function forget(id) {
  asleep.delete(id);
  delete lastSeen[id];
}

// Every minute: check which tabs haven't been viewed for long enough
function check() {
  const s = store.config.settings;
  if (!s.sleepEnabled) return;
  const limit = (s.sleepMinutes || 30) * 60 * 1000;
  const now = Date.now();
  for (const tab of store.config.tabs) {
    if (!canSleep(tab) || !store.views[tab.id] || require('./split').visible(tab.id)) continue;
    if (now - (lastSeen[tab.id] || started) >= limit) sleep(tab.id);
  }
}

function start() {
  clearInterval(timer);
  timer = setInterval(check, 60 * 1000);
}

function setAllowed(id, allowed) {
  const tab = store.config.tabs.find(t => t.id === id);
  if (!tab) return;
  tab.noSleep = !allowed;
  config.save();
  views.broadcast();
}

Object.assign(module.exports, { canSleep, isAsleep, seen, sleep, wake, forget, start, check, setAllowed, startAsleep, shouldStartAsleep });
