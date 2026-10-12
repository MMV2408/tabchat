// Tray icon in the top bar, and keep running in the background.
// The close button hides the window instead of quitting the app.
const { Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const store = require('./store');
const config = require('./config');
const views = require('./views');
const actions = require('./actions');
const unread = require('./unread');
const dnd = require('./dnd');
const { t } = require('./i18n');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const ICON = path.join(ASSETS, 'icon.png');

// Tray icon: colored or white, with or without a red dot (unread messages)
const images = {};
function trayImage(withDot) {
  const name = (store.config.settings.whiteTray ? 'tray-white' : 'tray') + (withDot ? '-unread' : '');
  if (!images[name]) {
    images[name] = nativeImage.createFromPath(path.join(ASSETS, name + '.png')).resize({ width: 24, height: 24 });
  }
  return images[name];
}

let tray = null;
let pending = null; // timer for creating the icon

// ---------- show / hide the window ----------
function showWindow(opts = {}) {
  if (!store.alive()) return;
  const win = store.win;
  if (win.isMinimized()) win.restore();
  // Ubuntu (GNOME) sometimes refuses to bring a window to the front and shows
  // "Tabchat is ready" instead. A window that reappears does get focus,
  // so if Tabchat is open but behind something else: hide it briefly and show it again.
  // force (notification click): always, so Ubuntu's activation token is surely used
  if (win.isVisible() && (opts.force || !win.isFocused())) win.hide();
  win.show();
  win.focus();
  views.focusActive();
}

function toggleWindow() {
  if (store.win.isVisible()) store.win.hide();
  else showWindow();
}

// ---------- the icon ----------
// Create or remove, depending on the setting
function sync() {
  const wanted = store.config.settings.runInBackground && !store.quitting;
  if (wanted && !tray && !pending) {
    // On Linux an icon created right at startup sometimes doesn't appear.
    // So we wait a second until the desktop is ready for it.
    pending = setTimeout(() => {
      pending = null;
      if (tray || store.quitting || !store.config.settings.runInBackground) return;
      tray = new Tray(trayImage(unread.any()));
      tray.setToolTip('Tabchat');
      tray.on('click', toggleWindow); // doesn't work on every Linux version, so it's in the menu too
      refresh();
    }, 1000);
  } else if (!wanted) {
    destroy();
  }
}

// Unregister the icon cleanly (on quit), otherwise Ubuntu sometimes
// doesn't show it the next time
function destroy() {
  if (pending) { clearTimeout(pending); pending = null; }
  if (tray) { tray.destroy(); tray = null; }
}

// Rebuild the menu (after every change to tabs or visibility)
function refresh() {
  if (!tray || !store.alive()) return;

  // Icon and tooltip: red dot for unread messages
  const total = unread.total();
  tray.setImage(trayImage(unread.any()));
  const dndText = dnd.isOn() ? t('tray.tipDnd', { label: dnd.label() }) : '';
  tray.setToolTip((total ? t('tray.tipUnread', { n: total }) : unread.any() ? t('tray.tipNew') : 'Tabchat') + dndText);

  const visible = store.win.isVisible();
  const tabItems = views.getState().tabs.map(t => ({
    label: t.fullLabel + (typeof t.unread === 'number' && t.unread ? ` (${t.unread})` : t.unread === 'dot' ? '  •' : '') + (t.muted ? '  🔇' : '') + (t.asleep ? '  💤' : ''),
    click: () => { showWindow(); views.show(t.id); }
  }));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t(visible ? 'tray.hide' : 'tray.show'), click: toggleWindow },
    { type: 'separator' },
    ...tabItems,
    { type: 'separator' },
    { label: t('tray.settings'), click: () => { showWindow(); views.show('home'); } },
    {
      label: t('tray.reopen'),
      enabled: store.closedTabs.length > 0,
      click: () => { showWindow(); actions.reopenTab(); }
    },
    { label: t('tray.reloadAll'), click: () => actions.reloadAll() },
    { type: 'separator' },
    {
      label: dnd.isOn() ? t('tray.dndOn', { label: dnd.label() }) : t('tray.dnd'),
      submenu: [
        { label: t('dnd.1h'), click: () => dnd.set(60) },
        { label: t('dnd.tomorrow'), click: () => dnd.set('tomorrow') },
        { label: t('dnd.forever'), click: () => dnd.set('forever') },
        { type: 'separator' },
        { label: t('dnd.turnOff'), enabled: dnd.isManual(), click: () => dnd.set(null) }
      ]
    },
    ...(require('./platform').storeManaged ? [] : [{
      label: t('tray.autostart'),
      type: 'checkbox',
      checked: !!store.config.settings.autostart,
      click: (item) => actions.setSetting('autostart', item.checked)
    }]),
    { type: 'separator' },
    ...(require('./updater').getStatus().state === 'ready'
      ? [{ label: t('tray.update', { v: require('./updater').getStatus().version }), click: () => require('./updater').install() }]
      : []),
    { label: t('tray.quit'), click: () => actions.quit() }
  ]));
}

// ---------- close button ----------
function onClose(event) {
  if (store.quitting || !store.config.settings.runInBackground) return; // just quit
  event.preventDefault();
  store.win.hide();

  // Explain the first time that Tabchat keeps running
  if (!store.config.trayNoticeShown) {
    store.config.trayNoticeShown = true;
    config.save();
    if (Notification.isSupported()) {
      require('./notify').notify({ title: t('tray.noticeTitle'), body: t('tray.noticeBody') });
    }
  }
}

// Attach to the window (called from window.js)
function init() {
  store.win.on('close', onClose);
  store.win.on('show', refresh);
  store.win.on('hide', refresh);
  sync();
}

Object.assign(module.exports, { init, sync, refresh, destroy, showWindow });
