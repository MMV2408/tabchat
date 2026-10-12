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
  brightspaceUrl: ''     // Brightspace van je school (één keer invullen in het +-scherm)
};

function configFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load() {
  try {
    const c = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
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
      feedback: c.feedback || null
    };
  } catch {
    // Geen of kapot bestand: met een lege app beginnen
    return { tabs: [], settings: { ...DEFAULT_SETTINGS }, loginNoticeShown: false, trayNoticeShown: false, dndUntil: null, lastVersion: null, donateNever: false };
  }
}

function save() {
  try {
    fs.writeFileSync(configFile(), JSON.stringify(store.config, null, 2));
  } catch (err) {
    console.error('Kon instellingen niet opslaan:', err);
  }
}

module.exports = { DEFAULT_SETTINGS, load, save };
