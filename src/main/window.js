// Het hoofdvenster opbouwen: tabbalk, +-scherm, snelzoekvenster en de tabbladen.
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

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

function create() {
  store.config = config.load();
  autostart.sync(); // pad in het autostart-bestand bijwerken (bv. na een update)

  // Via autostart gestart: verborgen in de tray (alleen als er een tray-icoon is)
  const hidden = autostart.startedHidden && store.config.settings.runInBackground;

  const win = store.win = new BaseWindow({
    width: 1200,
    height: 800,
    title: 'Tabchat',
    autoHideMenuBar: true,
    backgroundColor: '#1e1f22',
    icon: ICON,
    show: !hidden
  });

  // De drie eigen schermen
  const prefs = { preload: PRELOAD };
  const bar = store.bar = new WebContentsView({ webPreferences: prefs });
  const home = store.home = new WebContentsView({ webPreferences: prefs });
  const palette = store.palette = new WebContentsView({ webPreferences: prefs });
  palette.setBackgroundColor('#00000000'); // doorzichtig, zodat de app erachter zichtbaar blijft

  win.contentView.addChildView(bar);
  win.contentView.addChildView(home);
  bar.webContents.on('before-input-event', shortcuts.handler('bar'));
  home.webContents.on('before-input-event', shortcuts.handler('home'));
  palette.webContents.on('before-input-event', shortcuts.handler('palette'));
  bar.webContents.loadFile(path.join(RENDERER, 'tabs.html'));
  home.webContents.loadFile(path.join(RENDERER, 'home.html'));
  palette.webContents.loadFile(path.join(RENDERER, 'palette.html'));

  // De opgeslagen tabbladen. Het eerste tabblad wordt altijd geladen (dat zie je meteen);
  // de rest mag slapend opstarten als dat aanstaat.
  const firstId = store.config.tabs.length ? store.config.tabs[0].id : null;
  for (const tab of store.config.tabs) {
    if (tab.id !== firstId && sleep.shouldStartAsleep(tab)) sleep.startAsleep(tab.id);
    else views.createServiceView(tab);
  }
  win.contentView.addChildView(palette); // bovenop alles
  store.active = store.config.tabs.length ? store.config.tabs[0].id : 'home';
  if (store.active !== 'home') store.lastTab = store.active;

  win.on('resize', views.layout);
  win.on('focus', views.focusActive);
  home.webContents.on('focus', () => {
    if (store.active !== 'home' || store.paletteOpen) setImmediate(views.focusActive);
  });
  views.layout();
  tray.init(); // tray-icoon + kruisje = verbergen
  dnd.apply(); // Niet storen van vorige keer (bv. "tot morgen") weer toepassen
  sleep.start(); // slaapstand: elke minuut kijken welke tabbladen mogen slapen

  // Sneltoetsen direct laten werken bij het opstarten:
  // eerst de tabbalk (laadt meteen), daarna het tabblad zodra dat klaar is
  bar.webContents.once('did-finish-load', () => {
    const target = store.active === 'home' ? home : store.views[store.active];
    if (target && target.webContents.isLoading()) bar.webContents.focus();
    else views.focusActive();
  });
  const first = store.active === 'home' ? home : store.views[store.active];
  if (first) first.webContents.once('dom-ready', () => views.focusActive());
}

module.exports = { create };
