// Saving and loading tabs and settings in ~/.config/tabchat/config.json
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { CATALOG } = require('./catalog');

// A new setting = one line here (plus a switch in home.html)
const DEFAULT_SETTINGS = {
  language: 'auto', // 'auto', 'nl' or 'en'
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
  followSystemDnd: true, // follow Do not disturb of Ubuntu/GNOME
  theme: 'system',       // 'system', 'dark' or 'light'
  openLinks: 'default',  // 'default', 'internal' or a browser id (e.g. 'firefox')
  brightspaceUrl: '',    // your school's Brightspace (entered once on the + screen)
  tabBar: 'normal',      // 'normal', 'compact' (icons only) or 'autohide' (appears at the top near the mouse)
  hiddenServices: [],    // built-in services hidden from the + screen
  cardOrder: [],         // order of the cards on the + screen (dragged)
  hardwareAcceleration: true // off = fix for display problems, takes effect after a restart
};

// Read one setting before the app is ready (e.g. hardware acceleration must be chosen before startup)
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
    require('./custom').registerAll(c.custom); // your own websites first, otherwise their tabs would be dropped
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
      icons: c.icons && typeof c.icons === 'object' ? c.icons : {},
      split: c.split && typeof c.split === 'object' ? c.split : null
    };
  } catch {
    // No file or a broken one: start with an empty app
    return { tabs: [], settings: { ...DEFAULT_SETTINGS }, loginNoticeShown: false, trayNoticeShown: false, dndUntil: null, lastVersion: null, donateNever: false, custom: [], icons: {} };
  }
}

function save() {
  try {
    // Incognito tabs are never saved
    const data = { ...store.config, tabs: store.config.tabs.filter(t => !t.temp) };
    fs.writeFileSync(configFile(), JSON.stringify(data, null, 2));
  } catch (err) {
    require('./log').error('saving settings failed:', err);
  }
}

module.exports = { DEFAULT_SETTINGS, load, save, peekSetting };
