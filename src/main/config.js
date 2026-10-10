// Opslaan en laden van tabbladen en instellingen in ~/.config/Tabchat/config.json
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { CATALOG } = require('./catalog');

// Een nieuwe instelling = één regel hier (plus een schakelaar in home.html)
const DEFAULT_SETTINGS = {
  spellcheck: false,
  shareMicrosoft: true,
  stayLoggedIn: true,
  runInBackground: true,
  unreadBadges: true,
  autostart: false,
  whiteTray: false
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
      dndUntil: c.dndUntil || null
    };
  } catch {
    // Geen of kapot bestand: met een lege app beginnen
    return { tabs: [], settings: { ...DEFAULT_SETTINGS }, loginNoticeShown: false, trayNoticeShown: false, dndUntil: null };
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
