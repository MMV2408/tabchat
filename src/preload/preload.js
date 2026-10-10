const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabchat', {
  // status
  getState: () => ipcRenderer.invoke('get-state'),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),

  // tabbladen
  open: (id) => ipcRenderer.send('open', id),
  add: (service) => ipcRenderer.send('add', service),
  remove: (id) => ipcRenderer.send('remove', id),
  back: () => ipcRenderer.send('back'),
  tabMenu: (id) => ipcRenderer.send('tab-menu', id),
  reorder: (id, to) => ipcRenderer.send('reorder', id, to),
  setTabSleep: (id, allowed) => ipcRenderer.send('tab-sleep', id, allowed),

  // instellingen
  setSetting: (key, value) => ipcRenderer.send('set-setting', key, value),
  setDnd: (mode) => ipcRenderer.send('set-dnd', mode), // minuten, 'tomorrow', 'forever' of null
  onShowShortcuts: (cb) => ipcRenderer.on('show-shortcuts', () => cb()),

  // snelzoeken
  onPaletteOpen: (cb) => ipcRenderer.on('palette-open', (_e, s) => cb(s)),
  paletteRun: (item) => ipcRenderer.send('palette-run', item),
  paletteClose: () => ipcRenderer.send('palette-close')
});
