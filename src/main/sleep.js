// Slaapstand voor tabbladen.
// Een tabblad dat je een tijd niet hebt bekeken, wordt uit het geheugen gehaald.
// Klik je erop, dan laadt het opnieuw (je blijft ingelogd).
// Let op: een slapend tabblad krijgt geen meldingen en geen tellers.
const store = require('./store');
const config = require('./config');
const views = require('./views');
const microsoft = require('./microsoft');
const { CATALOG } = require('./catalog');

const asleep = new Set();   // tabbladen die nu slapen
const lastSeen = {};        // tabblad-id -> wanneer je het voor het laatst bekeek
const started = Date.now();
let timer = null;

// Mag dit tabblad slapen? Eigen keuze van de gebruiker gaat voor,
// anders de standaard van de dienst (chat-apps blijven wakker, zie catalog.js).
function canSleep(tab) {
  if (typeof tab.noSleep === 'boolean') return !tab.noSleep;
  return !CATALOG[tab.service].awake;
}

function isAsleep(id) {
  return asleep.has(id);
}

// Onthouden wanneer een tabblad bekeken is
function seen(id) {
  if (id && id !== 'home') lastSeen[id] = Date.now();
}

// Laten slapen. Nooit: het tabblad dat je bekijkt, een tabblad dat geluid maakt
// (bv. een gesprek) of een Microsoft-tabblad dat nog wacht met inloggen.
function sleep(id) {
  const v = store.views[id];
  if (!v || id === store.active) return false;
  if (v.webContents.isCurrentlyAudible()) return false;
  if (microsoft.waiting.has(id)) return false;
  asleep.add(id);
  views.removeForSleep(id);
  views.broadcast();
  return true;
}

// Wakker maken (gebeurt vanzelf als je het tabblad opent, zie views.show)
function wake(id) {
  if (!asleep.delete(id)) return;
  const tab = store.config.tabs.find(t => t.id === id);
  if (tab) views.createServiceView(tab);
}

// Bij het opstarten: tabblad meteen als slapend markeren (wordt dan niet geladen)
function startAsleep(id) {
  asleep.add(id);
}

// Slapend opstarten? Alleen als de slaapstand aanstaat en het tabblad mag slapen
function shouldStartAsleep(tab) {
  const s = store.config.settings;
  return s.sleepEnabled && s.sleepOnStart && canSleep(tab);
}

// Tabblad gesloten of verwijderd
function forget(id) {
  asleep.delete(id);
  delete lastSeen[id];
}

// Elke minuut kijken welke tabbladen lang genoeg niet bekeken zijn
function check() {
  const s = store.config.settings;
  if (!s.sleepEnabled) return;
  const limit = (s.sleepMinutes || 30) * 60 * 1000;
  const now = Date.now();
  for (const tab of store.config.tabs) {
    if (!canSleep(tab) || !store.views[tab.id] || tab.id === store.active) continue;
    if (now - (lastSeen[tab.id] || started) >= limit) sleep(tab.id);
  }
}

function start() {
  clearInterval(timer);
  timer = setInterval(check, 60 * 1000);
}

// Per tabblad instellen of het mag slapen
function setAllowed(id, allowed) {
  const tab = store.config.tabs.find(t => t.id === id);
  if (!tab) return;
  tab.noSleep = !allowed;
  config.save();
  views.broadcast();
}

Object.assign(module.exports, { canSleep, isAsleep, seen, sleep, wake, forget, start, check, setAllowed, startAsleep, shouldStartAsleep });
