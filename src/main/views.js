// The views in the window: creating, showing and hiding tabs, and sending
// the state to the tab bar and the + screen.
const { WebContentsView, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { UA, CATALOG, LOGIN_HOSTS, urlFor, isOwnHost, hostOf } = require('./catalog');
const log = require('./log');
const microsoft = require('./microsoft');
const shortcuts = require('./shortcuts');
const palette = require('./palette');
const unread = require('./unread');
const dnd = require('./dnd');
const sleep = require('./sleep');
const i18n = require('./i18n');

// Tab bar height: always 44 pixels (compact = icons only, same height). With "auto-hide"
// the bar takes no space and slides over the service when you move the mouse to the top.
const barMode = () => (store.config && store.config.settings.tabBar) || 'normal';
const barHeight = () => 44;
const ERROR_PAGE = path.join(__dirname, '..', 'renderer', 'error.html');

// ---------- own screens (+ screen, Ctrl+K, screen sharing): only loaded when needed ----------
// Each screen is its own process of ~100 MB. They're loaded when you open them and
// cleaned up when you haven't used them for a while.
const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const PAGES = { home: 'home.html', palette: 'palette.html', share: 'share.html', find: 'find.html' };
const STACK = ['home', 'bar', 'find', 'palette', 'share']; // bottom to top (above the tabs)
const dropTimers = {};

function page(name) {
  clearTimeout(dropTimers[name]);
  dropTimers[name] = null;
  if (store[name]) return store[name];
  const v = new WebContentsView({ webPreferences: { preload: PRELOAD } });
  if (name !== 'home') v.setBackgroundColor('#00000000'); // transparent, the app stays visible behind it
  if (name !== 'share' && name !== 'find') v.webContents.on('before-input-event', shortcuts.handler(name));
  if (name === 'home') {
    v.webContents.on('focus', () => {
      if (store.active !== 'home' || store.paletteOpen || store.shareOpen) setImmediate(focusActive);
    });
  }
  // Remember when the page has really loaded. Right after loadFile() isLoading() can still be
  // false (seen with process-per-site, where the renderer already exists): a message sent then
  // got lost, and Ctrl+K stayed open but empty and invisible, catching every click.
  v.ready = false;
  v.waiting = [];
  v.webContents.once('did-finish-load', () => {
    v.ready = true;
    for (const fn of v.waiting.splice(0)) fn();
  });
  v.webContents.loadFile(path.join(__dirname, '..', 'renderer', PAGES[name]));
  v.setVisible(false);
  const cv = store.win.contentView;
  cv.addChildView(v);
  store[name] = v;
  // Put whatever belongs above this screen back on top
  for (const other of STACK.slice(STACK.indexOf(name) + 1)) {
    if (store[other]) cv.addChildView(store[other]); // to the top, see palette.js
  }
  return v;
}

// fn(view) once the screen has loaded (the + screen gets a moment to fetch its texts)
function whenReady(name, fn) {
  const v = page(name);
  const go = () => setTimeout(() => { if (store[name] === v) fn(v); }, name === 'home' ? 250 : 0);
  if (v.ready) fn(v);
  else v.waiting.push(go);
}

function dropLater(name, ms) {
  clearTimeout(dropTimers[name]);
  dropTimers[name] = setTimeout(() => { dropTimers[name] = null; drop(name); }, ms);
}
function drop(name) {
  const v = store[name];
  if (!v || !store.alive()) return;
  if ((name === 'home' && store.active === 'home') || (name === 'palette' && store.paletteOpen) || (name === 'share' && store.shareOpen) || (name === 'find' && store.findOpen)) return;
  store[name] = null;
  try { store.win.contentView.removeChildView(v); } catch (e) { log.warn('remove view:', name, e); }
  v.webContents.close();
}

// ---------- state to the screens ----------
function labelFor(tab) {
  const same = store.config.tabs.filter(t => t.service === tab.service);
  const name = CATALOG[tab.service].name;
  return same.length > 1 ? `${name} ${same.indexOf(tab) + 1}` : name;
}

// "Work/school" or "Personal" label on Microsoft tabs, only if you have both
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
    split: require('./split').isShown() ? (({ left, right }) => ({ left, right }))(require('./split').pair()) : null,
    activeIsTab: !!views[active],
    activeMuted: mutedTabs.has(active),
    canReopen: closedTabs.length > 0,
    tabs: config.tabs.map(t => ({
      id: t.id,
      service: t.service,
      label: labelFor(t),
      tag: t.temp ? 'temp' : accountTag(t), // '', 'work', 'personal' or 'temp' (incognito)
      fullLabel: labelFor(t) + (t.temp ? ` (${i18n.t('acct.temp')})` : accountTag(t) ? ` (${i18n.t('acct.' + accountTag(t))})` : ''),
      color: CATALOG[t.service].color,
      muted: mutedTabs.has(t.id),
      unread: unread.get(t.id), // count, 'dot' or 0
      asleep: sleep.isAsleep(t.id),
      canSleep: sleep.canSleep(t),
      nav: navState(t.id) // back/forward for the ← → buttons (only for visible tabs)
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
    restartNeeded: config.settings.hardwareAcceleration !== false ? !store.hwAtStart : !!store.hwAtStart, // hardware acceleration changed
    maximized: store.win ? store.win.isMaximized() : false
  };
}

// Can this tab go back / forward? Only for tabs you can see, the rest doesn't need buttons
function navState(id) {
  const v = store.views[id];
  if (!v || v.webContents.isDestroyed() || !require('./split').visible(id)) return null;
  const h = v.webContents.navigationHistory;
  return { back: h.canGoBack(), forward: h.canGoForward() };
}

function broadcast() {
  if (!store.alive()) return;
  const s = getState();
  store.bar.webContents.send('state', s);
  if (store.home) store.home.webContents.send('state', s);
  require('./tray').refresh(); // update the tabs in the tray menu
}

// ---------- creating a tab ----------
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

  // Some sites (like Discord) mark their top bar as a "drag region" for their own desktop app.
  // In a window without a title bar that would drag the whole Tabchat window, and with an
  // auto-hidden tab bar it would swallow clicks at the top. We turn that off for every site.
  v.webContents.on('dom-ready', () => {
    v.webContents.insertCSS('*, *::before, *::after { -webkit-app-region: no-drag !important; }').catch(e => log.warn('insert css:', tab.id, e));
  });
  v.webContents.on('did-finish-load', () => {
    const url = v.webContents.getURL();
    if (url.startsWith('file:')) {
      v.webContents.setZoomFactor(1); // error page always at normal size
    } else {
      // Restore the zoom after a page loads
      const t = store.config.tabs.find(x => x.id === tab.id);
      if (t && t.zoom) v.webContents.setZoomFactor(t.zoom);
      checkRawPage(tab, v);
    }
    // After a reload (F5) put the focus back on the active tab
    if (tab.id === store.active && store.win.isFocused()) focusActive();
  });

  // New page in a visible tab: update the ← → buttons (debounced, chat apps navigate a lot)
  let navTimer = null;
  const navChanged = () => {
    if (!require('./split').visible(tab.id)) return;
    clearTimeout(navTimer);
    navTimer = setTimeout(broadcast, 150);
  };
  v.webContents.on('did-navigate', navChanged);
  require('./find').watch(v.webContents); // Ctrl+F results
  require('./downloads').watch(v.webContents.session); // downloads go to ~/Downloads, with a notification
  v.webContents.on('did-navigate-in-page', navChanged);

  // A hidden tab (e.g. Outlook loading in the background) can "steal" the focus.
  // Then the shortcuts stop working, so we put the focus straight back.
  v.webContents.on('focus', () => {
    // Split view: clicking the other half makes that tab the active one
    if (tab.id !== store.active && !store.paletteOpen && !store.shareOpen && require('./split').isShown() && require('./split').has(tab.id)) {
      store.active = tab.id;
      sleep.seen(tab.id);
      return broadcast();
    }
    if (tab.id !== store.active || store.paletteOpen || store.shareOpen) setImmediate(focusActive);
  });

  if (CATALOG[tab.service].group) {
    microsoft.keepLogin(ses, microsoft.partitionFor(tab));
    microsoft.watchLogin(tab, v);
  }

  // Sign-in windows inside the app; other links according to "Open links in" (see links.js)
  const links = require('./links');
  v.webContents.setWindowOpenHandler(({ url }) => {
    const host = hostOf(url);
    if (LOGIN_HOSTS.includes(host)) return { action: 'allow' };
    if (isOwnHost(tab, host)) return { action: 'allow' }; // e.g. Brightspace opens its own page in a window
    if (/^https?:/.test(url)) { links.open(url, ses); return { action: 'deny' }; }
    // Empty window (Outlook does that): open it hidden and catch the address
    if (!url || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
    return { action: 'deny' };
  });
  v.webContents.on('did-create-window', (child, { url }) => {
    if (!url || url === 'about:blank') links.catchBlank(child, ses);
  });

  // Error page: "Change address" clicked? Go to the + screen, to the address field
  v.webContents.on('did-navigate-in-page', (_e, url) => {
    if (!url.startsWith('file:') || !url.includes('#tabchat-fix-url')) return;
    const key = CATALOG[tab.service].settingUrl;
    show('home');
    if (key) whenReady('home', (h) => h.webContents.send('focus-setting', key));
  });

  // Error page when the service doesn't load (no internet, outage) or crashes
  v.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file:')) return; // -3 = aborted, not a real error
    showError(tab, v, { code, desc, url: /^https?:/.test(url) ? url : urlFor(tab) });
  });
  v.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || store.views[tab.id] !== v) return; // closed by us (e.g. tab sleep)
    showError(tab, v, { reason: 'crash' });
  });

  // Screen sharing: show the picker (see share.js)
  ses.setDisplayMediaRequestHandler((_request, callback) => require('./share').request(callback));

  // Wait if another Microsoft tab with the same login is already signing in
  if (microsoft.shouldWait(tab)) microsoft.waiting.add(tab.id);
  else v.webContents.loadURL(urlFor(tab));

  v.setVisible(false);
  store.win.contentView.addChildView(v);
  store.views[tab.id] = v;
  dnd.applyToView(tab.id, v); // sound off with Do not disturb
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

// Remove from memory for tab sleep (the tab stays in the bar)
function removeForSleep(id) {
  const v = store.views[id];
  if (!v) return;
  store.win.contentView.removeChildView(v);
  v.webContents.close();
  delete store.views[id];
  unread.forget(id); // a sleeping tab can't count
}

// ---------- error page ----------
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
      fix: svc.askUrl ? '1' : '', // address differs per school: "Change address" button for an unknown address
      lang: i18n.lang()
    }
  });
}

// Some services (e.g. Outlook) show their own offline page as raw code when there's
// no internet. That page does "load", so did-fail-load notices nothing.
// If we recognize such a page, we show our own error page.
function checkRawPage(tab, v) {
  v.webContents.executeJavaScript(
    "document.contentType === 'text/plain' && /^\\s*<(!doctype|html)/i.test((document.body && document.body.innerText) || '')"
  ).then(isRaw => {
    if (isRaw) showError(tab, v, { code: -106, desc: 'OFFLINE_PAGE', url: urlFor(tab) });
  }).catch(e => log.info('raw page check:', tab.id, e.message)); // page navigated away meanwhile
}

// Reload. Is an error page showing? Then try the service again.
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

// ---------- showing the tab bar with "auto-hide" ----------
let hideTimer = null;
function revealBar(on) {
  if (!store.alive()) return;
  if (on) cancelHide();
  if (barMode() !== 'autohide') { store.barRevealed = false; return; }
  if (on === store.barRevealed) return;
  if (on && (store.paletteOpen || store.shareOpen)) return;
  store.barRevealed = on;
  if (on) {
    // Put the bar on top of the service (quick search and screen sharing stay above it)
    const cv = store.win.contentView;
    for (const v of [store.bar, store.palette, store.share]) if (v) cv.addChildView(v); // to the top, see palette.js
  }
  layout();
}
// Mouse off the bar: hide again after a short pause
function hideBarSoon() {
  if (store.barHeld) return; // dragging a tab: stay open
  if (hideTimer) return; // already hiding: don't restart every time
  hideTimer = setTimeout(() => { hideTimer = null; revealBar(false); }, 500);
}
// While a tab is being dragged, the auto-hidden bar must not disappear
function holdBar(on) {
  store.barHeld = !!on;
  if (on) { cancelHide(); revealBar(true); } else hideBarSoon();
}
function cancelHide() {
  clearTimeout(hideTimer);
  hideTimer = null;
}

// Watch the mouse ourselves (the border of a window without a title bar catches the mouse,
// so the page doesn't always notice the top edge). Only with "auto-hide".
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
    if (p.y >= b.y - 2 && p.y <= b.y + 24) revealBar(true);                                // top strip
    else if (store.barRevealed && p.y >= b.y && p.y <= b.y + barHeight()) cancelHide();        // on the bar
    else if (store.barRevealed) hideBarSoon();                                              // off the bar
  }, 120);
}

// ---------- showing ----------
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
  const halves = require('./split').place(area); // split view: two tabs side by side
  for (const [id, v] of Object.entries(views)) {
    const half = halves && halves[id];
    v.setBounds(half || area);
    v.setVisible(half ? true : id === active);
  }
  if (store.find) {
    const f = store.findOpen && store.views[active];
    if (f) store.find.setBounds(require('./find').bounds());
    store.find.setVisible(!!f);
  }
  if (pal) { pal.setBounds({ x: 0, y: 0, width, height }); pal.setVisible(paletteOpen); }
  if (store.share) { store.share.setBounds({ x: 0, y: 0, width, height }); store.share.setVisible(store.shareOpen); }
}

// The area below the tab bar where tabs are shown (window coordinates)
function contentArea() {
  const { width, height } = store.win.getContentBounds();
  const top = barMode() === 'autohide' ? 0 : barHeight();
  return { x: 0, y: top, width, height: height - top };
}

// Keyboard to the right screen, so the shortcuts always work
function focusActive() {
  if (store.shareOpen && store.share) return store.share.webContents.focus();
  if (store.paletteOpen && store.palette) return store.palette.webContents.focus();
  if (store.findOpen && store.find && store.views[store.active]) return store.find.webContents.focus();
  const target = store.active === 'home' ? page('home') : store.views[store.active];
  (target || store.bar).webContents.focus();
}

function show(id) {
  if (sleep.isAsleep(id)) sleep.wake(id); // sleeping tab: load it again
  if (microsoft.waiting.has(id)) microsoft.loadTab(id); // opened by the user: load it anyway
  sleep.seen(store.active); // previous tab: just viewed
  sleep.seen(id);
  if (store.active !== id && store.active !== 'home') store.prevTab = store.active;
  if (store.findOpen && id !== store.active) require('./find').close(); // other tab: close the find bar
  store.active = id;
  const split = require('./split');
  if (split.has(id)) { // split view: the other half has to be awake too
    const s = split.pair();
    const other = s.left === id ? s.right : s.left;
    if (sleep.isAsleep(other)) sleep.wake(other);
    sleep.seen(other);
  }
  if (id !== 'home') store.lastTab = id;
  if (id !== 'home' && store.home) dropLater('home', 3 * 60 * 1000); // + screen unused for 3 minutes: clean it up
  require('./theme').flush(id); // reload tabs with a new theme once you leave them
  layout();
  broadcast();
  if (!store.paletteOpen && !store.shareOpen) focusActive();
}

Object.assign(module.exports, {
  revealBar, hideBarSoon, holdBar, watchEdge,
  page, whenReady, dropLater, contentArea,
  getState, broadcast, createServiceView, destroyView, removeForSleep, reloadView, layout, focusActive, show
});
