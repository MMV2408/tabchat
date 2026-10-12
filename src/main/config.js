// Opslaan en laden van tabbladen en instellingen in ~/.config/Tabchat/config.json
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { CATALOG } = require('./catalog');

// Een nieuwe instelling = één regel hier (plus een schakelaar in home.html)
const DEFAULT_SETTINGS = {
  language: 'auto', // 'auto', 'nl' of 'en'
  spellcheck: false,
  shareMicrosoft: true,
  stayLoggedIn: true,
  runInBackground: true,
  unreadBadges: true,
  autostart: false,
  whiteTray: false,
  sleepEnabled: false,
  sleepMinutes: 30,
  sleepOnStart: false,
  autoUpdate: true,
  followSystemDnd: true, // Niet storen van Ubuntu/GNOME volgen
  theme: 'system',       // 'system', 'dark' of 'light'
  openLinks: 'default',  // 'default', 'internal' of een browser-id (bv. 'firefox')
  brightspaceUrl: '',    // Brightspace van je school (één keer invullen in het +-scherm)
  tabBar: 'normal',      // 'normal', 'compact' (alleen icoontjes) of 'autohide' (verschijnt bovenaan bij de muis)
  hiddenServices: [],    // vaste diensten die je uit het +-scherm hebt gehaald
  cardOrder: [],         // volgorde van de kaarten in het +-scherm (versleept)
  hardwareAcceleration: true // uit = hulp bij beeldproblemen, werkt na herstart
};

// Eén instelling lezen vóór de app klaar is (bv. hardwareversnelling moet je vóór het starten kiezen)
function peekSetting(key) {
  try {
    const s = JSON.parse(require('fs').readFileSync(configFile(), 'utf8')).settings || {};
    return key in s ? s[key] : DEFAULT_SETTINGS[key];
  } catch { return DEFAULT_SETTINGS[key]; }
}

function configFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load() {
  try {
    const c = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    require('./custom').registerAll(c.custom); // eigen websites eerst, anders vallen hun tabbladen weg
    return {
      tabs: Array.isArray(c.tabs) ? c.tabs.filter(t => CATALOG[t.service]) : [],
      settings: { ...DEFAULT_SETTINGS, ...(c.settings || {}) },
      loginNoticeShown: !!c.loginNoticeShown,
      trayNoticeShown: !!c.trayNoticeShown,
      dndUntil: c.dndUntil || null,
      lastVersion: c.lastVersion || null,
      donateNever: !!c.donateNever,
      donateAskedAt: c.donateAskedAt || null,
      firstUse: c.firstUse || null,
      feedback: c.feedback || null,
      custom: Array.isArray(c.custom) ? c.custom : [],
      icons: c.icons && typeof c.icons === 'object' ? c.icons : {}
    };
  } catch {
    // Geen of kapot bestand: met een lege app beginnen
    return { tabs: [], settings: { ...DEFAULT_SETTINGS }, loginNoticeShown: false, trayNoticeShown: false, dndUntil: null, lastVersion: null, donateNever: false, custom: [], icons: {} };
  }
}

function save() {
  try {
    // Incognito-tabbladen worden nooit bewaard
    const data = { ...store.config, tabs: store.config.tabs.filter(t => !t.temp) };
    fs.writeFileSync(configFile(), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Kon instellingen niet opslaan:', err);
  }
}

module.exports = { DEFAULT_SETTINGS, load, save, peekSetting };
