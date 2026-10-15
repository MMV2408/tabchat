const { contextBridge, ipcRenderer } = require('electron');

// Mouse at the top edge (on the + screen): show the hidden tab bar
let lastEdge = 0;
window.addEventListener('mousemove', (e) => {
  if (e.clientY > 24 || Date.now() - lastEdge < 400) return;
  lastEdge = Date.now();
  ipcRenderer.send('bar-edge');
}, { passive: true, capture: true });

contextBridge.exposeInMainWorld('tabchat', {
  getState: () => ipcRenderer.invoke('get-state'),
  getStrings: () => ipcRenderer.invoke('get-strings'),
  memStats: () => ipcRenderer.invoke('mem-stats'),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),

  open: (id) => ipcRenderer.send('open', id),
  add: (service, url) => ipcRenderer.send('add', service, url),
  onAskUrl: (cb) => ipcRenderer.on('ask-url', (_e, service) => cb(service)),
  checkUrl: (url) => ipcRenderer.invoke('check-url', url),
  checkSite: (url) => ipcRenderer.invoke('check-site', url),
  addCustom: (data, temp) => ipcRenderer.send('custom-add', data, temp),
  updateCustom: (id, data) => ipcRenderer.send('custom-update', id, data),
  removeCustom: (id) => ipcRenderer.send('custom-remove', id),
  winControl: (action) => ipcRenderer.send('win-control', action),
  barHover: (inside) => ipcRenderer.send('bar-hover', inside),
  barHold: (on) => ipcRenderer.send('bar-hold', on),
  splitDrag: (phase, x) => ipcRenderer.send('split-drag', phase, x),
  splitEven: () => ipcRenderer.send('split-even'),
  splitMenu: () => ipcRenderer.send('split-menu'),
  splitClose: () => ipcRenderer.send('split-close'),
  tabNav: (id, what) => ipcRenderer.send('tab-nav', id, what),
  findSearch: (text, next, back) => ipcRenderer.send('find-search', text, next, back),
  findClose: () => ipcRenderer.send('find-close'),
  onFindOpen: (cb) => ipcRenderer.on('find-open', (_e, text) => cb(text)),
  onFindResult: (cb) => ipcRenderer.on('find-result', (_e, active, total) => cb(active, total)),
  onSplitDragging: (cb) => ipcRenderer.on('split-dragging', (_e, on, offset) => cb(on, offset)),
  onFocusSetting: (cb) => ipcRenderer.on('focus-setting', (_e, key) => cb(key)),
  remove: (id) => ipcRenderer.send('remove', id),
  back: () => ipcRenderer.send('back'),
  tabMenu: (id) => ipcRenderer.send('tab-menu', id),
  reorder: (id, to) => ipcRenderer.send('reorder', id, to),
  setTabSleep: (id, allowed) => ipcRenderer.send('tab-sleep', id, allowed),

  setSetting: (key, value) => ipcRenderer.send('set-setting', key, value),
  setDnd: (mode) => ipcRenderer.send('set-dnd', mode), // minutes, 'tomorrow', 'forever' or null
  onShowShortcuts: (cb) => ipcRenderer.on('show-shortcuts', () => cb()),

  checkUpdate: () => ipcRenderer.send('update-check'),
  installUpdate: () => ipcRenderer.send('update-install'),
  openDonate: () => ipcRenderer.send('donate-open'),
  openFeedback: () => ipcRenderer.send('feedback-open'),
  openWhatsNew: () => ipcRenderer.send('whats-new-open'),
  whatsNewClosed: () => ipcRenderer.send('whats-new-closed'),
  dlOpen: (id) => ipcRenderer.send('dl-open', id),
  dlFolder: (id) => ipcRenderer.send('dl-folder', id),
  dlClear: () => ipcRenderer.send('dl-clear'),
  dlSeen: () => ipcRenderer.send('dl-seen'),
  dlShow: () => ipcRenderer.send('dl-show'),
  onShowDownloads: (cb) => ipcRenderer.on('show-downloads', () => cb()),
  onWhatsNew: (cb) => ipcRenderer.on('whats-new', (_e, d) => cb(d)),

  onShareOpen: (cb) => ipcRenderer.on('share-open', (_e, list) => cb(list)),
  sharePick: (id) => ipcRenderer.send('share-pick', id),
  shareCancel: () => ipcRenderer.send('share-cancel'),

  onPaletteOpen: (cb) => ipcRenderer.on('palette-open', (_e, s) => cb(s)),
  paletteRun: (item) => ipcRenderer.send('palette-run', item),
  paletteClose: () => ipcRenderer.send('palette-close'),
  relaunch: () => ipcRenderer.send('relaunch')
});
