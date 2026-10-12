const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabchat', {
  // status
  getState: () => ipcRenderer.invoke('get-state'),
  getStrings: () => ipcRenderer.invoke('get-strings'), // teksten in de gekozen taal
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),

  // tabbladen
  open: (id) => ipcRenderer.send('open', id),
  add: (service, url) => ipcRenderer.send('add', service, url),
  onAskUrl: (cb) => ipcRenderer.on('ask-url', (_e, service) => cb(service)),
  checkUrl: (url) => ipcRenderer.invoke('check-url', url),
  onFocusSetting: (cb) => ipcRenderer.on('focus-setting', (_e, key) => cb(key)),
  remove: (id) => ipcRenderer.send('remove', id),
  back: () => ipcRenderer.send('back'),
  tabMenu: (id) => ipcRenderer.send('tab-menu', id),
  reorder: (id, to) => ipcRenderer.send('reorder', id, to),
  setTabSleep: (id, allowed) => ipcRenderer.send('tab-sleep', id, allowed),

  // instellingen
  setSetting: (key, value) => ipcRenderer.send('set-setting', key, value),
  setDnd: (mode) => ipcRenderer.send('set-dnd', mode), // minuten, 'tomorrow', 'forever' of null
  onShowShortcuts: (cb) => ipcRenderer.on('show-shortcuts', () => cb()),

  // updates
  checkUpdate: () => ipcRenderer.send('update-check'),
  installUpdate: () => ipcRenderer.send('update-install'),
  openDonate: () => ipcRenderer.send('donate-open'),
  openFeedback: () => ipcRenderer.send('feedback-open'),
  openWhatsNew: () => ipcRenderer.send('whats-new-open'),
  whatsNewClosed: () => ipcRenderer.send('whats-new-closed'),
  onWhatsNew: (cb) => ipcRenderer.on('whats-new', (_e, d) => cb(d)),

  // scherm delen
  onShareOpen: (cb) => ipcRenderer.on('share-open', (_e, list) => cb(list)),
  sharePick: (id) => ipcRenderer.send('share-pick', id),
  shareCancel: () => ipcRenderer.send('share-cancel'),

  // snelzoeken
  onPaletteOpen: (cb) => ipcRenderer.on('palette-open', (_e, s) => cb(s)),
  paletteRun: (item) => ipcRenderer.send('palette-run', item),
  paletteClose: () => ipcRenderer.send('palette-close')
});
