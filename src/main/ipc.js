// Berichten van de schermen (tabbalk, +-scherm, Ctrl+K) naar de app.
// Elke knop in een .html-bestand komt via preload.js hier uit.
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

// Rechtsklikmenu op een tabblad
function showTabMenu(id) {
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  Menu.buildFromTemplate([
    { label: t('menu.reload'), accelerator: 'F5', click: () => actions.reload(id) },
    { label: t(store.mutedTabs.has(id) ? 'menu.unmute' : 'menu.mute'), accelerator: 'Alt+M', click: () => actions.toggleMute(id) },
    { type: 'separator' },
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
  ipcMain.handle('get-strings', () => i18n.strings()); // teksten in de gekozen taal

  // tabbladen
  ipcMain.on('open', (_e, id) => { if (id === 'home' || store.config.tabs.some(t => t.id === id)) views.show(id); });
  ipcMain.on('tab-sleep', (_e, id, allowed) => sleep.setAllowed(id, allowed));
  ipcMain.on('add', (_e, service, url) => actions.addTab(service, url));
  // Eigen titelbalk: − □ ✕
  ipcMain.on('win-control', (_e, action) => {
    if (!store.alive()) return;
    if (action === 'minimize') store.win.minimize();
    else if (action === 'maximize') store.win.isMaximized() ? store.win.unmaximize() : store.win.maximize();
    else if (action === 'close') store.win.close(); // met tray: verbergen (zie tray.js)
  });
  // Tabbalk automatisch verbergen: muis aan de bovenrand / van de balk af
  ipcMain.on('bar-edge', () => views.revealBar(true));
  ipcMain.on('bar-hover', (_e, inside) => { if (inside) views.revealBar(true); else views.hideBarSoon(); });
  ipcMain.handle('check-url', (_e, url) => require('./brightspace').check(url));
  // Eigen websites
  ipcMain.handle('check-site', (_e, url) => require('./custom').check(url));
  ipcMain.on('custom-add', (_e, data, temp) => actions.addCustom(data, temp));
  ipcMain.on('custom-update', (_e, id, data) => actions.updateCustom(id, data));
  ipcMain.on('custom-remove', (_e, id) => actions.removeCustom(id));
  ipcMain.on('remove', (_e, id) => actions.removeTab(id));
  ipcMain.on('back', () => actions.back());
  ipcMain.on('reorder', (_e, id, to) => actions.reorderTab(id, to));
  ipcMain.on('tab-menu', (_e, id) => showTabMenu(id));

  // instellingen
  ipcMain.on('set-setting', (_e, key, value) => actions.setSetting(key, value));

  // ongelezen: badge-getal van een dienst (zie preload/service.js)
  ipcMain.on('badge', (e, n) => {
    const id = Object.keys(store.views).find(k => store.views[k].webContents === e.sender);
    if (id) unread.setBadge(id, n);
  });

  // niet storen
  ipcMain.on('get-dnd', (e) => { e.returnValue = dnd.isOn(); }); // vraag van preload/service.js
  ipcMain.on('set-dnd', (_e, mode) => dnd.set(mode));

  // updates
  ipcMain.on('update-check', () => require('./updater').check());
  ipcMain.on('update-install', () => require('./updater').install());
  ipcMain.on('donate-open', () => require('./donate').open());
  ipcMain.on('feedback-open', () => require('./feedback').open());
  ipcMain.on('whats-new-open', () => require('./whatsnew').show(null));
  ipcMain.on('whats-new-closed', () => require('./donate').afterWhatsNew());
  // Klik op een melding van een dienst: venster tonen met dat tabblad vooraan
  // Meldingen van diensten via Ubuntu (zie notifier.js)
  ipcMain.on('notify-available', (e) => { e.returnValue = require('./notifier').isAvailable(); });
  const shown = new Map(); // tabblad + pagina-id -> D-Bus-id
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

  // scherm delen
  ipcMain.on('share-pick', (_e, id) => require('./share').pick(id));
  ipcMain.on('share-cancel', () => require('./share').cancel());

  // snelzoeken
  ipcMain.on('palette-close', () => palette.hide());
  ipcMain.on('palette-run', (_e, item) => palette.run(item));
}

module.exports = { register };
