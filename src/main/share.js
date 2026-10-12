// Screen sharing: a picker with all screens and windows.
// On Wayland (default on Ubuntu) the system shows its own picker;
// then we only get one source back and skip our own window.
const { desktopCapturer } = require('electron');
const store = require('./store');
const views = require('./views');

let pending = null; // { callback, sources } of the request that is open now

// Called when a service (Discord, Teams, ...) wants to share your screen
async function request(callback) {
  if (pending) cancel(); // previous request still open: cancel it first

  let sources;
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 }
    });
  } catch {
    return callback({});
  }
  if (!sources.length) return callback({});           // nothing chosen or nothing found
  if (sources.length === 1) return callback({ video: sources[0] }); // the system already chose

  pending = { callback, sources };
  open(sources);
}

function open(sources) {
  store.shareOpen = true;
  const v = views.page('share'); // only load it when needed
  store.win.contentView.removeChildView(v); // put it on top of everything
  store.win.contentView.addChildView(v);
  views.layout();
  const list = sources.map(s => ({
    id: s.id,
    name: s.name,
    type: s.id.startsWith('screen') ? 'screen' : 'window',
    thumb: s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL()
  }));
  views.whenReady('share', (w) => {
    if (!store.shareOpen) return;
    w.webContents.send('share-open', list);
    w.webContents.focus();
  });
}

function close() {
  store.shareOpen = false;
  views.layout();
  views.focusActive();
  views.dropLater('share', 5000);
}

function pick(id) {
  if (!pending) return;
  const source = pending.sources.find(s => s.id === id);
  pending.callback(source ? { video: source } : {});
  pending = null;
  close();
}

function cancel() {
  if (!pending) return;
  pending.callback({});
  pending = null;
  close();
}

Object.assign(module.exports, { request, pick, cancel });
