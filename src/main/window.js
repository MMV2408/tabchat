// Building the main window: tab bar, + screen, quick search and the tabs.
const { BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const store = require('./store');
const config = require('./config');
const views = require('./views');
const shortcuts = require('./shortcuts');
const tray = require('./tray');
const autostart = require('./autostart');
const dnd = require('./dnd');
const sleep = require('./sleep');
const updater = require('./updater');
const theme = require('./theme');

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

function create() {
  store.config = config.load();
  theme.apply(); // light/dark before the window appears
  autostart.sync(); // update the path in the autostart file (e.g. after an update)

  // Started via autostart: hidden in the tray (only if there is a tray icon)
  const hidden = autostart.startedHidden && store.config.settings.runInBackground;

  const win = store.win = new BaseWindow({
    width: 1200,
    height: 800,
    title: 'Tabchat',
    autoHideMenuBar: true,
    frame: false, // no Ubuntu title bar: the tab bar is the title bar (drag, − □ ✕)
    minWidth: 480,
    minHeight: 360,
    backgroundColor: theme.background(),
    icon: ICON,
    show: !hidden
  });

  // The tab bar. The + screen, Ctrl+K and screen sharing only load when opened (see views.page)
  const bar = store.bar = new WebContentsView({ webPreferences: { preload: PRELOAD } });
  win.contentView.addChildView(bar);
  bar.webContents.on('before-input-event', shortcuts.handler('bar'));
  bar.webContents.loadFile(path.join(RENDERER, 'tabs.html'));

  // The saved tabs. The first tab is always loaded (you see it right away);
  // the rest may start asleep if that's enabled.
  const firstId = store.config.tabs.length ? store.config.tabs[0].id : null;
  for (const tab of store.config.tabs) {
    if (tab.id !== firstId && sleep.shouldStartAsleep(tab)) sleep.startAsleep(tab.id);
    else views.createServiceView(tab);
  }
  store.active = store.config.tabs.length ? store.config.tabs[0].id : 'home';
  if (store.active !== 'home') store.lastTab = store.active;
  require('./split').restore(); // split view from last time: wake the other half

  win.on('resize', views.layout);
  // Maximize: update the icon of the □ button
  win.on('maximize', views.broadcast);
  win.on('unmaximize', views.broadcast);
  win.on('blur', () => views.revealBar(false));
  win.on('focus', views.focusActive);
  views.layout();
  views.watchEdge(); // auto-hide tab bar: watch the top edge
  tray.init(); // tray icon + close button = hide
  dnd.apply(); // re-apply Do not disturb from last time (e.g. "until tomorrow")
  dnd.watchSystem();
  theme.init(); // reload services when the theme changes
  sleep.start(); // tab sleep: check every minute which tabs may sleep
  updater.init(); // automatic updates (installed version only)

  // Make shortcuts work right away on startup:
  // first the tab bar (loads instantly), then the tab once it's ready
  bar.webContents.once('did-finish-load', () => {
    const target = store.active === 'home' ? store.home : store.views[store.active];
    if (target && target.webContents.isLoading()) bar.webContents.focus();
    else views.focusActive();
  });
  const first = store.active === 'home' ? store.home : store.views[store.active];
  if (first) first.webContents.once('dom-ready', () => views.focusActive());
}

module.exports = { create };
