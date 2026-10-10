// Tray-icoon rechtsboven in de balk, en op de achtergrond blijven draaien.
// Het kruisje verbergt het venster in plaats van de app af te sluiten.
const { Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const store = require('./store');
const config = require('./config');
const views = require('./views');
const actions = require('./actions');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');

let tray = null;
let pending = null; // timer voor het aanmaken van het icoon

// ---------- venster tonen / verbergen ----------
function showWindow() {
  store.win.show();
  store.win.focus();
  views.focusActive();
}

function toggleWindow() {
  if (store.win.isVisible()) store.win.hide();
  else showWindow();
}

// ---------- het icoon ----------
// Aanmaken of weghalen, afhankelijk van de instelling
function sync() {
  const wanted = store.config.settings.runInBackground && !store.quitting;
  if (wanted && !tray && !pending) {
    // Op Linux verschijnt een icoon dat direct bij het opstarten wordt gemaakt
    // soms niet. Daarom een seconde wachten tot het bureaublad er klaar voor is.
    pending = setTimeout(() => {
      pending = null;
      if (tray || store.quitting || !store.config.settings.runInBackground) return;
      const image = nativeImage.createFromPath(ICON).resize({ width: 24, height: 24 });
      tray = new Tray(image);
      tray.setToolTip('Tabchat');
      tray.on('click', toggleWindow); // werkt niet op elke Linux-versie, daarom ook in het menu
      refresh();
    }, 1000);
  } else if (!wanted) {
    destroy();
  }
}

// Icoon netjes afmelden (bij afsluiten), anders laat Ubuntu het de
// volgende keer soms niet meer zien
function destroy() {
  if (pending) { clearTimeout(pending); pending = null; }
  if (tray) { tray.destroy(); tray = null; }
}

// Menu opnieuw opbouwen (na elke verandering van tabbladen of zichtbaarheid)
function refresh() {
  if (!tray) return;
  const visible = store.win.isVisible();
  const tabItems = views.getState().tabs.map(t => ({
    label: t.label + (t.muted ? '  🔇' : ''),
    click: () => { showWindow(); views.show(t.id); }
  }));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? 'Tabchat verbergen' : 'Tabchat tonen', click: toggleWindow },
    { type: 'separator' },
    ...tabItems,
    { label: 'Dienst toevoegen…', click: () => { showWindow(); views.show('home'); } },
    { type: 'separator' },
    { label: 'Afsluiten', click: () => actions.quit() }
  ]));
}

// ---------- kruisje ----------
function onClose(event) {
  if (store.quitting || !store.config.settings.runInBackground) return; // gewoon afsluiten
  event.preventDefault();
  store.win.hide();

  // De eerste keer uitleggen dat Tabchat nog draait
  if (!store.config.trayNoticeShown) {
    store.config.trayNoticeShown = true;
    config.save();
    if (Notification.isSupported()) {
      new Notification({
        title: 'Tabchat draait op de achtergrond',
        body: 'Je krijgt nog steeds berichten. Open Tabchat via het icoon rechtsboven. ' +
              'Echt afsluiten: Ctrl+Q of "Afsluiten" in dat menu.',
        icon: ICON
      }).show();
    }
  }
}

// Koppelen aan het venster (wordt aangeroepen vanuit window.js)
function init() {
  store.win.on('close', onClose);
  store.win.on('show', refresh);
  store.win.on('hide', refresh);
  sync();
}

Object.assign(module.exports, { init, sync, refresh, destroy, showWindow });
