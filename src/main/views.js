// De schermen in het venster: tabbladen maken, tonen, verbergen en de status
// doorsturen naar de tabbalk en het +-scherm.
const { WebContentsView, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { UA, CATALOG, LOGIN_HOSTS, urlFor, isOwnHost } = require('./catalog');
const microsoft = require('./microsoft');
const shortcuts = require('./shortcuts');
const palette = require('./palette');
const unread = require('./unread');
const dnd = require('./dnd');
const sleep = require('./sleep');
const i18n = require('./i18n');

// Hoogte tabbalk: altijd 44 pixels (compact = alleen icoontjes, even hoog). Bij "automatisch verbergen"
// neemt de balk geen ruimte in en schuift hij over de dienst heen als je de muis naar boven beweegt.
const barMode = () => (store.config && store.config.settings.tabBar) || 'normal';
const barHeight = () => 44;
const ERROR_PAGE = path.join(__dirname, '..', 'renderer', 'error.html');

// ---------- eigen schermen (+-scherm, Ctrl+K, scherm delen): pas laden als je ze nodig hebt ----------
// Elk scherm is een eigen proces van ~100 MB. Ze worden geladen als je ze opent en weer
// opgeruimd als je ze een tijdje niet gebruikt.
const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const PAGES = { home: 'home.html', palette: 'palette.html', share: 'share.html' };
const STACK = ['home', 'bar', 'palette', 'share']; // van onder naar boven (boven de tabbladen)
const dropTimers = {};

function page(name) {
  clearTimeout(dropTimers[name]);
  dropTimers[name] = null;
  if (store[name]) return store[name];
  const v = new WebContentsView({ webPreferences: { preload: PRELOAD } });
  if (name !== 'home') v.setBackgroundColor('#00000000'); // doorzichtig, de app blijft erachter zichtbaar
  if (name !== 'share') v.webContents.on('before-input-event', shortcuts.handler(name));
  if (name === 'home') {
    v.webContents.on('focus', () => {
      if (store.active !== 'home' || store.paletteOpen || store.shareOpen) setImmediate(focusActive);
    });
  }
  v.webContents.loadFile(path.join(__dirname, '..', 'renderer', PAGES[name]));
  v.setVisible(false);
  const cv = store.win.contentView;
  cv.addChildView(v);
  store[name] = v;
  // Wat boven dit scherm hoort, weer bovenop leggen
  for (const other of STACK.slice(STACK.indexOf(name) + 1)) {
    if (store[other]) { cv.removeChildView(store[other]); cv.addChildView(store[other]); }
  }
  return v;
}

// fn(view) zodra het scherm geladen is (het +-scherm krijgt nog even om zijn teksten op te halen)
function whenReady(name, fn) {
  const v = page(name);
  const go = () => setTimeout(() => { if (store[name] === v) fn(v); }, name === 'home' ? 250 : 0);
  if (v.webContents.isLoading()) v.webContents.once('did-finish-load', go);
  else fn(v);
}

function dropLater(name, ms) {
  clearTimeout(dropTimers[name]);
  dropTimers[name] = setTimeout(() => { dropTimers[name] = null; drop(name); }, ms);
}
function drop(name) {
  const v = store[name];
  if (!v || !store.alive()) return;
  if ((name === 'home' && store.active === 'home') || (name === 'palette' && store.paletteOpen) || (name === 'share' && store.shareOpen)) return;
  store[name] = null;
  try { store.win.contentView.removeChildView(v); } catch {}
  v.webContents.close();
}

// ---------- status naar de schermen ----------
function labelFor(tab) {
  const same = store.config.tabs.filter(t => t.service === tab.service);
  const name = CATALOG[tab.service].name;
  return same.length > 1 ? `${name} ${same.indexOf(tab) + 1}` : name;
}

// Labeltje "School/werk" of "Privé" bij Microsoft-tabbladen, alleen als je ze allebei hebt
function accountOf(tab) {
  const g = CATALOG[tab.service].group;
  return g === 'microsoft' ? 'work' : g === 'microsoft-personal' ? 'personal' : '';
}
function accountTag(tab) {
  const kinds = new Set(store.config.tabs.map(accountOf));
  return kinds.has('work') && kinds.has('personal') ? accountOf(tab) : '';
}

function getState() {
  const { config, views, active, mutedTabs, closedTabs } = store;
  return {
    lang: i18n.lang(),
    active,
    activeIsTab: !!views[active],
    activeMuted: mutedTabs.has(active),
    canReopen: closedTabs.length > 0,
    tabs: config.tabs.map(t => ({
      id: t.id,
      service: t.service,
      label: labelFor(t),
      tag: t.temp ? 'temp' : accountTag(t), // '', 'work', 'personal' of 'temp' (incognito)
      fullLabel: labelFor(t) + (t.temp ? ` (${i18n.t('acct.temp')})` : accountTag(t) ? ` (${i18n.t('acct.' + accountTag(t))})` : ''),
      color: CATALOG[t.service].color,
      muted: mutedTabs.has(t.id),
      unread: unread.get(t.id), // aantal, 'dot' of 0
      asleep: sleep.isAsleep(t.id),
      canSleep: sleep.canSleep(t)
    })),
    dnd: { on: dnd.isOn(), manual: dnd.isManual(), label: dnd.label() },
    browsers: require('./links').browsers().map(b => ({ id: b.id, name: b.name })),
    platform: { kind: require('./platform').kind, storeManaged: require('./platform').storeManaged },
    update: require('./updater').getStatus(),
    catalog: Object.entries(CATALOG).filter(([, s]) => !s.temp).map(([id, s]) => ({
      id, name: s.name, key: s.key || '', color: s.color, base: s.base || null, askUrl: !!s.askUrl,
      custom: !!s.custom, icon: s.icon || null, school: s.group === 'microsoft',
      url: s.custom ? s.url : null,
      desc: s.custom ? s.desc : i18n.t('svc.' + (s.base || id))
    })),
    settings: config.settings,
    restartNeeded: config.settings.hardwareAcceleration !== false ? !store.hwAtStart : !!store.hwAtStart, // hardwareversnelling veranderd
    maximized: store.win ? store.win.isMaximized() : false
  };
}

function broadcast() {
  if (!store.alive()) return;
  const s = getState();
  store.bar.webContents.send('state', s);
  if (store.home) store.home.webContents.send('state', s);
  require('./tray').refresh(); // tabbladen in het tray-menu bijwerken
}

// ---------- tabblad maken ----------
function createServiceView(tab) {
  const v = new WebContentsView({
    webPreferences: {
      partition: microsoft.partitionFor(tab),
      preload: path.join(__dirname, '..', 'preload', 'service.js'),
      spellcheck: store.config.settings.spellcheck,
      zoomFactor: tab.zoom || 1
    }
  });
  const ses = v.webContents.session;
  ses.setSpellCheckerLanguages(['nl', 'en-US']);
  v.webContents.setUserAgent(UA);
  v.webContents.on('before-input-event', shortcuts.handler('tab'));
  unread.watch(tab, v);

  // Sommige sites (zoals Discord) markeren hun bovenbalk als "sleepgebied" voor hun eigen desktop-app.
  // In een venster zonder titelbalk zou je daar het hele Tabchat-venster mee slepen, en bij een
  // automatisch verborgen tabbalk vangt dat de klikken bovenin af. Dat zetten we voor elke site uit.
  v.webContents.on('dom-ready', () => {
    v.webContents.insertCSS('*, *::before, *::after { -webkit-app-region: no-drag !important; }').catch(() => {});
  });
  v.webContents.on('did-finish-load', () => {
    const url = v.webContents.getURL();
    if (url.startsWith('file:')) {
      v.webContents.setZoomFactor(1); // foutscherm altijd op normale grootte
    } else {
      // Zoom terugzetten na het laden van een pagina
      const t = store.config.tabs.find(x => x.id === tab.id);
      if (t && t.zoom) v.webContents.setZoomFactor(t.zoom);
      checkRawPage(tab, v);
    }
    // Na herladen (F5) de focus terugzetten op het actieve tabblad
    if (tab.id === store.active && store.win.isFocused()) focusActive();
  });

  // Een verborgen tabblad (bv. Outlook dat op de achtergrond laadt) kan de focus
  // "stelen". Dan werken de sneltoetsen niet meer. Zet de focus dan direct terug.
  v.webContents.on('focus', () => {
    if (tab.id !== store.active || store.paletteOpen || store.shareOpen) setImmediate(focusActive);
  });

  if (CATALOG[tab.service].group) {
    microsoft.keepLogin(ses, microsoft.partitionFor(tab));
    microsoft.watchLogin(tab, v);
  }

  // Inlogvensters in de app; andere links volgens "Links openen in" (zie links.js)
  const links = require('./links');
  v.webContents.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (LOGIN_HOSTS.includes(host)) return { action: 'allow' };
    if (isOwnHost(tab, host)) return { action: 'allow' }; // bv. Brightspace opent een eigen pagina in een venster
    if (/^https?:/.test(url)) { links.open(url, ses); return { action: 'deny' }; }
    // Leeg venster (Outlook doet dat): verborgen openen en het adres opvangen
    if (!url || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
    return { action: 'deny' };
  });
  v.webContents.on('did-create-window', (child, { url }) => {
    if (!url || url === 'about:blank') links.catchBlank(child, ses);
  });

  // Foutscherm: "Adres wijzigen" geklikt? Naar het +-scherm, naar het adresveld
  v.webContents.on('did-navigate-in-page', (_e, url) => {
    if (!url.startsWith('file:') || !url.includes('#tabchat-fix-url')) return;
    const key = CATALOG[tab.service].settingUrl;
    show('home');
    if (key) whenReady('home', (h) => h.webContents.send('focus-setting', key));
  });

  // Foutscherm als de dienst niet laadt (geen internet, storing) of vastloopt
  v.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file:')) return; // -3 = afgebroken, geen echte fout
    showError(tab, v, { code, desc, url: /^https?:/.test(url) ? url : urlFor(tab) });
  });
  v.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || store.views[tab.id] !== v) return; // zelf gesloten (bv. slaapstand)
    showError(tab, v, { reason: 'crash' });
  });

  // Scherm delen: keuzevenster tonen (zie share.js)
  ses.setDisplayMediaRequestHandler((_request, callback) => require('./share').request(callback));

  // Wachten als een ander Microsoft-tabblad met dezelfde login al bezig is
  if (microsoft.shouldWait(tab)) microsoft.waiting.add(tab.id);
  else v.webContents.loadURL(urlFor(tab));

  v.setVisible(false);
  store.win.contentView.addChildView(v);
  store.views[tab.id] = v;
  dnd.applyToView(tab.id, v); // geluid uit bij Niet storen
  if (store.paletteOpen) palette.bringToFront();
}

function destroyView(id) {
  sleep.forget(id);
  const v = store.views[id];
  if (!v) return;
  microsoft.waiting.delete(id);
  store.mutedTabs.delete(id);
  unread.forget(id);
  store.win.contentView.removeChildView(v);
  v.webContents.close();
  delete store.views[id];
}

// Uit het geheugen halen voor de slaapstand (tabblad blijft in de balk staan)
function removeForSleep(id) {
  const v = store.views[id];
  if (!v) return;
  store.win.contentView.removeChildView(v);
  v.webContents.close();
  delete store.views[id];
  unread.forget(id); // een slapend tabblad kan niet tellen
}

// ---------- foutscherm ----------
function showError(tab, v, info) {
  if (v.webContents.isDestroyed()) return;
  const svc = CATALOG[tab.service];
  v.webContents.loadFile(ERROR_PAGE, {
    query: {
      name: svc.name,
      color: svc.color,
      url: info.url || urlFor(tab),
      code: String(info.code || ''),
      desc: info.desc || '',
      reason: info.reason || '',
      fix: svc.askUrl ? '1' : '', // adres verschilt per school: knop "Adres wijzigen" bij een onbekend adres
      lang: i18n.lang()
    }
  });
}

// Sommige diensten (bv. Outlook) tonen zonder internet hun eigen offline-pagina
// als ruwe code. Die pagina "laadt" wel, dus did-fail-load merkt niets.
// Herkennen we zo'n pagina, dan tonen we ons eigen foutscherm.
function checkRawPage(tab, v) {
  v.webContents.executeJavaScript(
    "document.contentType === 'text/plain' && /^\\s*<(!doctype|html)/i.test((document.body && document.body.innerText) || '')"
  ).then(isRaw => {
    if (isRaw) showError(tab, v, { code: -106, desc: 'OFFLINE_PAGE', url: urlFor(tab) });
  }).catch(() => {});
}

// Herladen. Staat er een foutscherm? Dan de dienst opnieuw proberen.
function reloadView(id) {
  const v = store.views[id];
  if (!v) return;
  if (v.webContents.getURL().startsWith('file:')) {
    const tab = store.config.tabs.find(t => t.id === id);
    if (tab) v.webContents.loadURL(urlFor(tab));
  } else {
    v.webContents.reload();
  }
}

// ---------- tabbalk tonen bij "automatisch verbergen" ----------
let hideTimer = null;
function revealBar(on) {
  if (!store.alive()) return;
  if (on) cancelHide();
  if (barMode() !== 'autohide') { store.barRevealed = false; return; }
  if (on === store.barRevealed) return;
  if (on && (store.paletteOpen || store.shareOpen)) return;
  store.barRevealed = on;
  if (on) {
    // Balk bovenop de dienst leggen (snelzoeken en scherm delen blijven daarboven)
    const cv = store.win.contentView;
    for (const v of [store.bar, store.palette, store.share]) if (v) { cv.removeChildView(v); cv.addChildView(v); }
  }
  layout();
}
// Muis van de balk af: na een korte pauze weer verbergen
function hideBarSoon() {
  if (hideTimer) return; // al bezig met verbergen: niet steeds opnieuw beginnen
  hideTimer = setTimeout(() => { hideTimer = null; revealBar(false); }, 500);
}
function cancelHide() {
  clearTimeout(hideTimer);
  hideTimer = null;
}

// De muis zelf in de gaten houden (de rand van een venster zonder titelbalk vangt de muis af,
// dus de pagina merkt de bovenrand niet altijd). Alleen bij "automatisch verbergen".
let edgeTimer = null;
function watchEdge() {
  clearInterval(edgeTimer);
  edgeTimer = null;
  if (barMode() !== 'autohide') return;
  const { screen } = require('electron');
  edgeTimer = setInterval(() => {
    if (!store.alive() || !store.win.isVisible() || store.win.isMinimized()) return;
    const p = screen.getCursorScreenPoint();
    const b = store.win.getContentBounds();
    const insideX = p.x >= b.x && p.x <= b.x + b.width;
    if (!insideX) return;
    if (p.y >= b.y - 2 && p.y <= b.y + 24) revealBar(true);                                // bovenste strook
    else if (store.barRevealed && p.y >= b.y && p.y <= b.y + barHeight()) cancelHide();        // op de balk
    else if (store.barRevealed) hideBarSoon();                                              // van de balk af
  }, 120);
}

// ---------- tonen ----------
function layout() {
  if (!store.alive()) return;
  if (store.active === 'home') page('home');
  const { win, bar, home, palette: pal, views, active, paletteOpen } = store;
  const { width, height } = win.getContentBounds();
  const h = barHeight();
  const top = barMode() === 'autohide' ? 0 : h;
  const area = { x: 0, y: top, width, height: height - top };
  bar.setBounds({ x: 0, y: 0, width, height: h });
  bar.setVisible(barMode() !== 'autohide' || store.barRevealed);
  if (home) { home.setBounds(area); home.setVisible(active === 'home'); }
  for (const [id, v] of Object.entries(views)) {
    v.setBounds(area);
    v.setVisible(id === active);
  }
  if (pal) { pal.setBounds({ x: 0, y: 0, width, height }); pal.setVisible(paletteOpen); }
  if (store.share) { store.share.setBounds({ x: 0, y: 0, width, height }); store.share.setVisible(store.shareOpen); }
}

// Toetsenbord naar het juiste scherm, zodat de sneltoetsen altijd werken
function focusActive() {
  if (store.shareOpen && store.share) return store.share.webContents.focus();
  if (store.paletteOpen && store.palette) return store.palette.webContents.focus();
  const target = store.active === 'home' ? page('home') : store.views[store.active];
  (target || store.bar).webContents.focus();
}

function show(id) {
  if (sleep.isAsleep(id)) sleep.wake(id); // slapend tabblad: weer laden
  if (microsoft.waiting.has(id)) microsoft.loadTab(id); // zelf geopend: dan toch laden
  sleep.seen(store.active); // vorige tabblad: net nog bekeken
  sleep.seen(id);
  store.active = id;
  if (id !== 'home') store.lastTab = id;
  if (id !== 'home' && store.home) dropLater('home', 3 * 60 * 1000); // +-scherm 3 minuten niet gebruikt: opruimen
  require('./theme').flush(id); // tabbladen met een nieuw thema herladen zodra je wegklikt
  layout();
  broadcast();
  if (!store.paletteOpen && !store.shareOpen) focusActive();
}

Object.assign(module.exports, {
  revealBar, hideBarSoon, watchEdge,
  page, whenReady, dropLater,
  getState, broadcast, createServiceView, destroyView, removeForSleep, reloadView, layout, focusActive, show
});
