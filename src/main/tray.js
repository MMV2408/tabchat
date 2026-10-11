// Tray-icoon rechtsboven in de balk, en op de achtergrond blijven draaien.
// Het kruisje verbergt het venster in plaats van de app af te sluiten.
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

// Tray-icoon: gekleurd of wit, zonder of met rode stip (ongelezen berichten)
const images = {};
function trayImage(withDot) {
  const name = (store.config.settings.whiteTray ? 'tray-white' : 'tray') + (withDot ? '-unread' : '');
  if (!images[name]) {
    images[name] = nativeImage.createFromPath(path.join(ASSETS, name + '.png')).resize({ width: 24, height: 24 });
  }
  return images[name];
}

let tray = null;
let pending = null; // timer voor het aanmaken van het icoon

// ---------- venster tonen / verbergen ----------
function showWindow() {
  if (!store.alive()) return;
  const win = store.win;
  if (win.isMinimized()) win.restore();
  // Ubuntu (GNOME) weigert soms een venster naar voren te halen en toont dan
  // "Tabchat is gereed". Een venster dat opnieuw verschijnt krijgt wél voorrang,
  // dus als Tabchat open staat maar achter iets anders zit: even verbergen en weer tonen.
  if (win.isVisible() && !win.isFocused()) win.hide();
  win.show();
  win.focus();
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
      tray = new Tray(trayImage(unread.any()));
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
  if (!tray || !store.alive()) return;

  // Icoon en tooltip: rode stip bij ongelezen berichten
  const total = unread.total();
  tray.setImage(trayImage(unread.any()));
  const dndText = dnd.isOn() ? t('tray.tipDnd', { label: dnd.label() }) : '';
  tray.setToolTip((total ? t('tray.tipUnread', { n: total }) : unread.any() ? t('tray.tipNew') : 'Tabchat') + dndText);

  const visible = store.win.isVisible();
  const tabItems = views.getState().tabs.map(t => ({
    label: t.label + (typeof t.unread === 'number' && t.unread ? ` (${t.unread})` : t.unread === 'dot' ? '  •' : '') + (t.muted ? '  🔇' : '') + (t.asleep ? '  💤' : ''),
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
      require('./notify').notify({ title: t('tray.noticeTitle'), body: t('tray.noticeBody') });
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
