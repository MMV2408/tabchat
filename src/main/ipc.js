// Berichten van de schermen (tabbalk, +-scherm, Ctrl+K) naar de app.
// Elke knop in een .html-bestand komt via preload.js hier uit.
const { ipcMain, Menu } = require('electron');
const store = require('./store');
const views = require('./views');
const actions = require('./actions');
const palette = require('./palette');
const unread = require('./unread');
const dnd = require('./dnd');

// Rechtsklikmenu op een tabblad
function showTabMenu(id) {
  const tabs = store.config.tabs;
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  Menu.buildFromTemplate([
    { label: 'Herladen', accelerator: 'F5', click: () => actions.reload(id) },
    { label: store.mutedTabs.has(id) ? 'Geluid aanzetten' : 'Geluid dempen', accelerator: 'Alt+M', click: () => actions.toggleMute(id) },
    { type: 'separator' },
    { label: 'Naar links', accelerator: 'Ctrl+Shift+PageUp', enabled: i > 0, click: () => actions.moveTab(id, -1) },
    { label: 'Naar rechts', accelerator: 'Ctrl+Shift+PageDown', enabled: i < tabs.length - 1, click: () => actions.moveTab(id, 1) },
    { type: 'separator' },
    { label: 'Tabblad sluiten', accelerator: 'Ctrl+W', click: () => actions.closeTab(id) }
  ]).popup({ window: store.win });
}

function register() {
  ipcMain.handle('get-state', () => views.getState());

  // tabbladen
  ipcMain.on('open', (_e, id) => { if (id === 'home' || store.views[id]) views.show(id); });
  ipcMain.on('add', (_e, service) => actions.addTab(service));
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

  // snelzoeken
  ipcMain.on('palette-close', () => palette.hide());
  ipcMain.on('palette-run', (_e, item) => palette.run(item));
}

module.exports = { register };
