// Messages from the screens (tab bar, + screen, Ctrl+K) to the app.
// Every button in an .html file ends up here via preload.js.
const { ipcMain, Menu } = require('electron');
const store = require('./store');
const views = require('./views');
const actions = require('./actions');
const palette = require('./palette');
const unread = require('./unread');
const dnd = require('./dnd');
const sleep = require('./sleep');
const i18n = require('./i18n');
const { t } = i18n;

// Right-click menu on a tab
function showTabMenu(id) {
  const split = require('./split');
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  Menu.buildFromTemplate([
    { label: t('menu.reload'), accelerator: 'F5', click: () => actions.reload(id) },
    { label: t('menu.duplicate'), click: () => actions.duplicateTab(id) },
    split.has(id) && split.isShown()
      ? { label: t('menu.unsplit'), accelerator: 'Ctrl+\\', click: () => split.close() }
      : { label: t('menu.split'), accelerator: 'Ctrl+\\', enabled: tabs.length > 1 && (id !== store.active ? !!store.views[store.active] : true),
          click: () => (id === store.active ? split.toggle() : split.open(store.active, id)) },
    { type: 'separator' },
    { label: t('menu.copyAddress'), enabled: !!store.views[id], click: () => actions.copyAddress(id) },
    { label: t('menu.openInBrowser'), enabled: !!store.views[id], click: () => actions.openInBrowser(id) },
    { type: 'separator' },
    { label: t(store.mutedTabs.has(id) ? 'menu.unmute' : 'menu.mute'), accelerator: 'Alt+M', click: () => actions.toggleMute(id) },
    { label: t('menu.sleepNow'), enabled: !sleep.isAsleep(id), click: () => actions.sleepNow(id) },
    { label: t('menu.neverSleep'), type: 'checkbox', checked: !sleep.canSleep(tabs[i]), click: (item) => sleep.setAllowed(id, !item.checked) },
    { type: 'separator' },
    { label: t('menu.left'), accelerator: 'Ctrl+Shift+PageUp', enabled: i > 0, click: () => actions.moveTab(id, -1) },
    { label: t('menu.right'), accelerator: 'Ctrl+Shift+PageDown', enabled: i < tabs.length - 1, click: () => actions.moveTab(id, 1) },
    { type: 'separator' },
    { label: t('menu.close'), accelerator: 'Ctrl+W', click: () => actions.closeTab(id) }
  ]).popup({ window: store.win });
}

function register() {
  ipcMain.handle('get-state', () => views.getState());
  ipcMain.handle('get-strings', () => i18n.strings());
  ipcMain.handle('mem-stats', () => require('./memory').stats());

  ipcMain.on('open', (_e, id) => { if (id === 'home' || store.config.tabs.some(t => t.id === id)) views.show(id); });
  ipcMain.on('tab-sleep', (_e, id, allowed) => sleep.setAllowed(id, allowed));
  ipcMain.on('add', (_e, service, url) => actions.addTab(service, url));
  // Custom title bar: − □ ✕
  ipcMain.on('win-control', (_e, action) => {
    if (!store.alive()) return;
    if (action === 'minimize') store.win.minimize();
    else if (action === 'maximize') store.win.isMaximized() ? store.win.unmaximize() : store.win.maximize();
    else if (action === 'close') store.win.close(); // with tray: hide (see tray.js)
  });
  // Auto-hide tab bar: mouse at the top edge / off the bar
  ipcMain.on('bar-edge', () => views.revealBar(true));
  ipcMain.on('bar-hover', (_e, inside) => { if (inside) views.revealBar(true); else views.hideBarSoon(); });
  ipcMain.on('split-drag', (_e, phase, x) => require('./split').drag(phase, x));
  ipcMain.on('split-even', () => require('./split').even());
  ipcMain.on('split-menu', () => require('./split').menu());
  ipcMain.on('split-close', () => require('./split').close());
  // Find in page (Ctrl+F)
  ipcMain.on('find-search', (_e, text, next, back) => require('./find').search(String(text || ''), next, back));
  ipcMain.on('find-close', () => require('./find').close());
  // ← → ⟳ ⌂ in the tab bar
  ipcMain.on('tab-nav', (_e, id, what) => {
    if (!store.views[id]) return;
    if (what === 'back') actions.navigate(-1, id);
    else if (what === 'forward') actions.navigate(1, id);
    else if (what === 'reload') actions.reload(id);
    else if (what === 'home') actions.goHome(id);
  });
  // Back/forward buttons on the mouse, from inside a service
  ipcMain.on('mouse-nav', (e, dir) => {
    const id = Object.keys(store.views).find(k => store.views[k].webContents === e.sender);
    if (id) actions.navigate(dir, id);
  });
  ipcMain.on('bar-hold', (_e, on) => views.holdBar(on)); // keep the auto-hidden bar open while dragging a tab
  ipcMain.handle('check-url', (_e, url) => require('./brightspace').check(url));
  ipcMain.handle('check-site', (_e, url) => require('./custom').check(url));
  ipcMain.on('custom-add', (_e, data, temp) => actions.addCustom(data, temp));
  ipcMain.on('custom-update', (_e, id, data) => actions.updateCustom(id, data));
  ipcMain.on('custom-remove', (_e, id) => actions.removeCustom(id));
  ipcMain.on('remove', (_e, id) => actions.removeTab(id));
  ipcMain.on('back', () => actions.back());
  ipcMain.on('reorder', (_e, id, to) => actions.reorderTab(id, to));
  ipcMain.on('tab-menu', (_e, id) => showTabMenu(id));

  ipcMain.on('set-setting', (_e, key, value) => actions.setSetting(key, value));

  // unread: badge count of a service (see preload/service.js)
  ipcMain.on('badge', (e, n) => {
    const id = Object.keys(store.views).find(k => store.views[k].webContents === e.sender);
    if (id) unread.setBadge(id, n);
  });

  ipcMain.on('get-dnd', (e) => { e.returnValue = dnd.isOn(); }); // asked by preload/service.js
  ipcMain.on('set-dnd', (_e, mode) => dnd.set(mode));

  ipcMain.on('update-check', () => require('./updater').check());
  ipcMain.on('update-install', () => require('./updater').install());
  ipcMain.on('donate-open', () => require('./donate').open());
  ipcMain.on('feedback-open', () => require('./feedback').open());
  ipcMain.on('whats-new-open', () => require('./whatsnew').show(null));
  ipcMain.on('whats-new-closed', () => require('./donate').afterWhatsNew());
  // Click on a service notification: show the window with that tab in front
  // Service notifications via Ubuntu (see notifier.js)
  ipcMain.on('notify-available', (e) => { e.returnValue = require('./notifier').isAvailable(); });
  const shown = new Map(); // tab + page id -> D-Bus id
  ipcMain.on('web-notify', (e, n) => {
    const tabId = Object.keys(store.views).find(k => store.views[k].webContents === e.sender);
    if (!tabId || !n) return;
    const wc = e.sender;
    const key = tabId + ':' + n.id;
    const send = (type) => { if (!wc.isDestroyed()) wc.send('notify-event', { id: n.id, type }); };
    require('./notifier').show({
      title: n.title, body: n.body, image: n.image,
      onClick: () => { shown.delete(key); require('./tray').showWindow(); views.show(tabId); send('click'); },
      onClose: () => { shown.delete(key); send('close'); }
    }, (dbusId) => { if (dbusId) shown.set(key, dbusId); });
  });
  ipcMain.on('web-notify-close', (e, id) => {
    const tabId = Object.keys(store.views).find(k => store.views[k].webContents === e.sender);
    const key = tabId + ':' + id;
    if (shown.has(key)) { require('./notifier').close(shown.get(key)); shown.delete(key); }
  });

  ipcMain.on('notification-click', (e) => {
    const id = Object.keys(store.views).find(k => store.views[k].webContents === e.sender);
    if (!id) return;
    require('./tray').showWindow();
    views.show(id);
  });

  ipcMain.on('share-pick', (_e, id) => require('./share').pick(id));
  ipcMain.on('share-cancel', () => require('./share').cancel());

  ipcMain.on('palette-close', () => palette.hide());
  ipcMain.on('relaunch', () => actions.relaunch());
  ipcMain.on('palette-run', (_e, item) => palette.run(item));
}

module.exports = { register };
