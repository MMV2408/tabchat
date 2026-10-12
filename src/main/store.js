// Shared app state. All other files read and write here,
// so everything that applies "right now" is in one place.
module.exports = {
  win: null,
  bar: null,
  home: null,
  palette: null,
  share: null,
  find: null,
  findOpen: false,
  config: null,   // saved settings and tabs (see config.js)

  views: {},              // tab id -> view of that service
  active: 'home',         // what is visible now: a tab id or 'home'
  barRevealed: false,     // tab bar temporarily visible with "auto-hide"
  barHeld: false,         // a tab is being dragged: keep the auto-hidden bar open
  lastTab: null,          // last opened tab (for Esc on the + screen)
  paletteOpen: false,
  shareOpen: false,
  mutedTabs: new Set(),   // muted tabs (this session only)
  closedTabs: [],         // closed tabs, for Ctrl+Shift+T
  quitting: false,        // true once the app really quits (then don't hide to the tray)

  // Does the window still exist? (while quitting, tabs can still send signals)
  alive() {
    return !!this.win && !this.win.isDestroyed();
  }
};
