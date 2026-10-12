// Scherm delen: een keuzevenster met alle schermen en vensters.
// Op Wayland (standaard op Ubuntu) toont het systeem zelf al een keuzevenster;
// dan krijgen we maar één bron terug en slaan we ons eigen venster over.
const { desktopCapturer } = require('electron');
const store = require('./store');
const views = require('./views');

let pending = null; // { callback, sources } van het verzoek dat nu openstaat

// Aangeroepen als een dienst (Discord, Teams, ...) je scherm wil delen
async function request(callback) {
  if (pending) cancel(); // vorig verzoek nog open: dat eerst afbreken

  let sources;
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 }
    });
  } catch {
    return callback({});
  }
  if (!sources.length) return callback({});           // niets gekozen of niets gevonden
  if (sources.length === 1) return callback({ video: sources[0] }); // systeem heeft al gekozen

  pending = { callback, sources };
  open(sources);
}

// ---------- keuzevenster ----------
function open(sources) {
  store.shareOpen = true;
  const v = views.page('share'); // pas laden als je hem nodig hebt
  store.win.contentView.removeChildView(v); // bovenop alles leggen
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

// Gekozen: delen
function pick(id) {
  if (!pending) return;
  const source = pending.sources.find(s => s.id === id);
  pending.callback(source ? { video: source } : {});
  pending = null;
  close();
}

// Annuleren: niets delen
function cancel() {
  if (!pending) return;
  pending.callback({});
  pending = null;
  close();
}

Object.assign(module.exports, { request, pick, cancel });
