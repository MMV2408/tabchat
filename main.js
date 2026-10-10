const { app, BaseWindow, WebContentsView, ipcMain, shell, desktopCapturer, session, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const BAR = 44; // hoogte tabbalk in pixels

// Alle diensten die een gebruiker kan toevoegen.
// key = letter voor Alt+letter in het +-scherm
const CATALOG = {
  whatsapp: { name: 'WhatsApp', key: 'w', url: 'https://web.whatsapp.com',               color: '#25D366', desc: 'Chatten met je telefoonnummer' },
  discord:  { name: 'Discord',  key: 'd', url: 'https://discord.com/app',                color: '#5865F2', desc: 'Servers, vrienden en spraak' },
  teams:    { name: 'Teams',    key: 't', url: 'https://teams.microsoft.com',            color: '#6264A7', desc: 'School en werk (Microsoft)', group: 'microsoft' },
  outlook:  { name: 'Outlook',  key: 'o', url: 'https://outlook.office.com/mail/',       color: '#0078D4', desc: 'E-mail en agenda', group: 'microsoft' },
  onedrive: { name: 'OneDrive', key: 'n', url: 'https://www.office.com/launch/onedrive', color: '#0364B8', desc: 'Je bestanden in de cloud', group: 'microsoft' }
};

// Inlogvensters die binnen de app mogen openen in plaats van in de browser
const LOGIN_HOSTS = [
  'login.microsoftonline.com', 'login.microsoft.com', 'login.live.com',
  'teams.microsoft.com', 'teams.live.com', 'outlook.office.com', 'outlook.live.com',
  'www.microsoft365.com', 'www.office.com', 'onedrive.live.com'
];

// Domeinen van de Microsoft-apps zelf. Alles daarbuiten (login.microsoftonline.com,
// de inlogpagina van je school zoals die van de HvA) telt als "inlogscherm".
const MS_APP_DOMAINS = [
  'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft',
  'outlook.office.com', 'outlook.office365.com', 'outlook.live.com', 'outlook.cloud.microsoft',
  'microsoft365.com', 'office.com', 'sharepoint.com', 'onedrive.live.com', 'cloud.microsoft'
];

function isMsAppHost(host) {
  return MS_APP_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

const DEFAULT_SETTINGS = { spellcheck: false, shareMicrosoft: true, stayLoggedIn: true };

let win, bar, home, palette, config;
const views = {};
let active = 'home';
let lastTab = null;        // laatst geopende tabblad (voor Esc in het +-scherm)
let paletteOpen = false;
const mutedTabs = new Set(); // gedempte tabbladen (alleen deze sessie)
const closedTabs = [];       // gesloten tabbladen, voor Ctrl+Shift+T

// ---------- opslag ----------
function configFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    return {
      tabs: Array.isArray(c.tabs) ? c.tabs.filter(t => CATALOG[t.service]) : [],
      settings: { ...DEFAULT_SETTINGS, ...(c.settings || {}) },
      loginNoticeShown: !!c.loginNoticeShown
    };
  } catch {
    return { tabs: [], settings: { ...DEFAULT_SETTINGS }, loginNoticeShown: false };
  }
}

function saveConfig() {
  fs.writeFileSync(configFile(), JSON.stringify(config, null, 2));
}

// ---------- status naar de schermen sturen ----------
function labelFor(tab) {
  const same = config.tabs.filter(t => t.service === tab.service);
  const name = CATALOG[tab.service].name;
  return same.length > 1 ? `${name} ${same.indexOf(tab) + 1}` : name;
}

function state() {
  return {
    active,
    activeIsTab: !!views[active],
    activeMuted: mutedTabs.has(active),
    canReopen: closedTabs.length > 0,
    tabs: config.tabs.map(t => ({
      id: t.id,
      service: t.service,
      label: labelFor(t),
      color: CATALOG[t.service].color,
      muted: mutedTabs.has(t.id)
    })),
    catalog: Object.entries(CATALOG).map(([id, s]) => ({ id, name: s.name, key: s.key, color: s.color, desc: s.desc })),
    settings: config.settings
  };
}

function broadcast() {
  const s = state();
  bar.webContents.send('state', s);
  home.webContents.send('state', s);
}

// ---------- opslag per tabblad (logins) ----------
// Met "Eén Microsoft-account" delen Teams, Outlook en OneDrive dezelfde opslag.
// Tweede accounts (bv. "outlook-2") delen met "onedrive-2" enz.
function partitionFor(tab) {
  const group = CATALOG[tab.service].group;
  if (group && config.settings.shareMicrosoft) {
    const suffix = tab.id.slice(tab.service.length); // '' of '-2'
    return 'persist:' + group + suffix;
  }
  return 'persist:' + tab.id;
}

// Microsoft-tabbladen met dezelfde login laden niet tegelijk, anders vraagt elk
// tabblad apart om in te loggen (en om tweestapsverificatie).
// Het eerste tabblad laadt direct; de rest wacht tot dat tabblad ingelogd is.
const msReady = new Set(); // logins (partities) die deze sessie al ingelogd zijn
const waiting = new Set(); // tabbladen die nog wachten met laden

function loadTab(id) {
  const tab = config.tabs.find(t => t.id === id);
  if (!tab || !views[id]) return;
  waiting.delete(id);
  views[id].webContents.loadURL(CATALOG[tab.service].url);
}

function onMsLoggedIn(tab) {
  const part = partitionFor(tab);
  // 2 seconden wachten zodat Microsoft alle login-cookies heeft opgeslagen
  setTimeout(() => {
    for (const t of config.tabs) {
      if (t.id === tab.id || partitionFor(t) !== part || !views[t.id]) continue;
      if (waiting.has(t.id)) { loadTab(t.id); continue; }
      // Staat het andere tabblad nog op een inlogscherm? Dan opnieuw laden.
      let host = '';
      try { host = new URL(views[t.id].webContents.getURL()).hostname; } catch {}
      if (host && !isMsAppHost(host)) loadTab(t.id);
    }
  }, 2000);
}

// Microsoft en schoolaccounts gebruiken "sessie-cookies" die verdwijnen als je de app
// sluit. Hier maken we die cookies 14 dagen geldig, net als "Aangemeld blijven".
const keptSessions = new Set();
function keepLogin(ses, part) {
  if (keptSessions.has(part)) return;
  keptSessions.add(part);
  ses.cookies.on('changed', (_e, cookie, _cause, removed) => {
    if (removed || !cookie.session || !config.settings.stayLoggedIn) return;
    const host = cookie.domain.replace(/^\./, '');
    const details = {
      url: (cookie.secure ? 'https://' : 'http://') + host + (cookie.path || '/'),
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: Date.now() / 1000 + 14 * 24 * 3600
    };
    if (!cookie.hostOnly) details.domain = cookie.domain;
    ses.cookies.set(details).catch(() => {});
  });
}

// ---------- tabbladen maken en tonen ----------
function createServiceView(tab) {
  const v = new WebContentsView({
    webPreferences: {
      partition: partitionFor(tab),
      spellcheck: config.settings.spellcheck,
      zoomFactor: tab.zoom || 1
    }
  });
  const ses = v.webContents.session;
  ses.setSpellCheckerLanguages(['nl', 'en-US']);
  v.webContents.setUserAgent(UA);
  v.webContents.on('before-input-event', keyHandler('tab'));

  // Zoom terugzetten na het laden van een pagina
  v.webContents.on('did-finish-load', () => {
    const t = config.tabs.find(x => x.id === tab.id);
    if (t && t.zoom) v.webContents.setZoomFactor(t.zoom);
    // Na herladen (F5) de focus terugzetten op het actieve tabblad
    if (tab.id === active && win.isFocused()) focusActive();
  });

  // Een verborgen tabblad (bv. Outlook dat op de achtergrond laadt) kan de focus
  // "stelen". Dan gaan je toetsen naar een onzichtbaar scherm en werken de
  // sneltoetsen niet meer. Zet de focus dan direct terug.
  v.webContents.on('focus', () => {
    if (tab.id !== active || paletteOpen) setImmediate(focusActive);
  });

  if (CATALOG[tab.service].group) {
    keepLogin(ses, partitionFor(tab));

    // Merken wanneer dit tabblad van het inlogscherm terug naar de dienst gaat
    let onLogin = false;
    v.webContents.on('did-navigate', (_e, url) => {
      let host = '';
      try { host = new URL(url).hostname; } catch {}
      if (!host) return;
      const part = partitionFor(tab);
      if (!isMsAppHost(host)) {
        onLogin = true;
      } else if (onLogin || !msReady.has(part)) {
        onLogin = false;
        msReady.add(part);
        if (config.settings.shareMicrosoft) onMsLoggedIn(tab);
      }
    });
  }

  // Inlogvensters in de app, andere links in de gewone browser
  v.webContents.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (LOGIN_HOSTS.includes(host)) return { action: 'allow' };
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Scherm delen (alleen beeld)
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then(sources => {
      callback({ video: sources[0] });
    });
  });

  // Wachten als een ander Microsoft-tabblad met dezelfde login al bezig is
  const part = partitionFor(tab);
  const wait = CATALOG[tab.service].group && config.settings.shareMicrosoft && !msReady.has(part) &&
    config.tabs.some(t => t.id !== tab.id && views[t.id] && partitionFor(t) === part);
  if (wait) waiting.add(tab.id);
  else v.webContents.loadURL(CATALOG[tab.service].url);

  v.setVisible(false);
  win.contentView.addChildView(v);
  views[tab.id] = v;
  if (paletteOpen) bringPaletteToFront();
}

function destroyView(id) {
  const v = views[id];
  if (!v) return;
  waiting.delete(id);
  mutedTabs.delete(id);
  win.contentView.removeChildView(v);
  v.webContents.close();
  delete views[id];
}

function layout() {
  const { width, height } = win.getContentBounds();
  const area = { x: 0, y: BAR, width, height: height - BAR };
  bar.setBounds({ x: 0, y: 0, width, height: BAR });
  home.setBounds(area);
  home.setVisible(active === 'home');
  for (const [id, v] of Object.entries(views)) {
    v.setBounds(area);
    v.setVisible(id === active);
  }
  palette.setBounds({ x: 0, y: 0, width, height });
  palette.setVisible(paletteOpen);
}

// Toetsenbord naar het juiste scherm, zodat de sneltoetsen altijd werken
function focusActive() {
  if (paletteOpen) return palette.webContents.focus();
  const target = active === 'home' ? home : views[active];
  (target || bar).webContents.focus();
}

function show(id) {
  if (waiting.has(id)) loadTab(id); // zelf geopend: dan toch laden
  active = id;
  if (id !== 'home') lastTab = id;
  layout();
  broadcast();
  // Toetsenbord naar het geopende tabblad, zodat sneltoetsen blijven werken
  if (!paletteOpen) focusActive();
}

// ---------- acties ----------
function nextId(service) {
  // Eerste keer "whatsapp", tweede keer "whatsapp-2" enz. (eigen login per tabblad)
  let id = service;
  let n = 2;
  while (config.tabs.some(t => t.id === id)) id = `${service}-${n++}`;
  return id;
}

function addTab(service) {
  if (!CATALOG[service]) return;
  const tab = { id: nextId(service), service };
  config.tabs.push(tab);
  saveConfig();
  createServiceView(tab);
  show(tab.id);
  if (CATALOG[service].group && !config.loginNoticeShown) showLoginNotice();
}

// Sluiten: tabblad weg, maar login blijft bewaard (dus snel weer toe te voegen)
function closeTab(id = active) {
  const i = config.tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  closedTabs.push({ tab: { ...config.tabs[i] }, index: i });
  config.tabs.splice(i, 1);
  saveConfig();
  destroyView(id);
  if (lastTab === id) lastTab = null;
  if (active === id) {
    const next = config.tabs[i] || config.tabs[i - 1];
    show(next ? next.id : 'home');
  } else {
    broadcast();
  }
}

function reopenTab() {
  const closed = closedTabs.pop();
  if (!closed) return;
  const tab = closed.tab;
  if (config.tabs.some(t => t.id === tab.id)) tab.id = nextId(tab.service);
  config.tabs.splice(Math.min(closed.index, config.tabs.length), 0, tab);
  saveConfig();
  createServiceView(tab);
  show(tab.id);
}

function moveTab(id, dir) {
  const i = config.tabs.findIndex(t => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= config.tabs.length) return;
  [config.tabs[i], config.tabs[j]] = [config.tabs[j], config.tabs[i]];
  saveConfig();
  broadcast();
}

function cycle(dir) {
  const ids = config.tabs.map(t => t.id);
  if (!ids.length) return;
  const i = ids.indexOf(active);
  const next = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length;
  show(ids[next]);
}

function reload(id = active) {
  if (views[id]) views[id].webContents.reload();
}

function toggleMute(id = active) {
  if (!views[id]) return;
  const muted = !mutedTabs.has(id);
  views[id].webContents.setAudioMuted(muted);
  if (muted) mutedTabs.add(id); else mutedTabs.delete(id);
  broadcast();
}

function zoom(delta, id = active) {
  const tab = config.tabs.find(t => t.id === id);
  if (!tab || !views[id]) return;
  const z = delta === 0 ? 1 : Math.min(2, Math.max(0.5, Math.round(((tab.zoom || 1) + delta) * 10) / 10));
  tab.zoom = z;
  views[id].webContents.setZoomFactor(z);
  saveConfig();
}

function navigate(dir, id = active) {
  const h = views[id] && views[id].webContents.navigationHistory;
  if (!h) return;
  if (dir < 0 && h.canGoBack()) h.goBack();
  if (dir > 0 && h.canGoForward()) h.goForward();
}

function toggleFullScreen() {
  win.setFullScreen(!win.isFullScreen());
}

function showShortcuts() {
  hidePalette();
  show('home');
  home.webContents.send('show-shortcuts');
}

// Bij afsluiten eerst alle logins (cookies) naar schijf schrijven
let quitting = false;
async function quit() {
  if (quitting) return;
  quitting = true;
  const parts = new Set([...config.tabs.map(partitionFor), ...keptSessions]);
  await Promise.all([...parts].map(p =>
    session.fromPartition(p).cookies.flushStore().catch(() => {})
  ));
  app.quit();
}

// ---------- snelzoeken (Ctrl+K) ----------
function bringPaletteToFront() {
  win.contentView.removeChildView(palette);
  win.contentView.addChildView(palette);
}

function openPalette() {
  paletteOpen = true;
  bringPaletteToFront();
  layout();
  palette.webContents.send('palette-open', state());
  palette.webContents.focus();
}

function hidePalette() {
  if (!paletteOpen) return;
  paletteOpen = false;
  layout();
  focusActive();
}

function togglePalette() {
  if (paletteOpen) hidePalette(); else openPalette();
}

const ACTIONS = {
  reload: () => reload(),
  mute: () => toggleMute(),
  close: () => closeTab(),
  reopen: () => reopenTab(),
  zoomIn: () => zoom(0.1),
  zoomOut: () => zoom(-0.1),
  zoomReset: () => zoom(0),
  fullscreen: () => toggleFullScreen(),
  settings: () => show('home'),
  shortcuts: () => showShortcuts(),
  quit: () => quit()
};

// ---------- sneltoetsen ----------
// source: 'tab', 'bar', 'home' of 'palette'
function keyHandler(source) {
  return (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
    const ctrl = input.control || input.meta;
    const { alt, shift } = input;
    const run = (fn) => { event.preventDefault(); fn(); };

    // Werkt overal, ook in het snelzoekvenster
    if (ctrl && !alt && !shift && key === 'k') return run(togglePalette);
    if (ctrl && !alt && !shift && key === 'q') return run(quit);
    if (source === 'palette') return; // de rest regelt het snelzoekvenster zelf

    if (alt && !ctrl && !shift) {
      // Alt+1 t/m Alt+8: naar dat tabblad, Alt+9: laatste tabblad
      if (/^[1-9]$/.test(key)) {
        return run(() => {
          const i = key === '9' ? config.tabs.length - 1 : Number(key) - 1;
          if (config.tabs[i]) show(config.tabs[i].id);
        });
      }
      // In het +-scherm: Alt+beginletter voegt een nieuw tabblad van die dienst toe
      if (active === 'home') {
        const service = Object.keys(CATALOG).find(s => CATALOG[s].key === key);
        if (service) return run(() => addTab(service));
      }
      if (key === 't') return run(() => show('home'));
      if (key === 'm') return run(() => toggleMute());
      if (key === 'ArrowLeft') return run(() => navigate(-1));
      if (key === 'ArrowRight') return run(() => navigate(1));
    }

    if (ctrl && !alt) {
      if (key === 'Tab') return run(() => cycle(shift ? -1 : 1));
      if (!shift && key === 'w') return run(() => closeTab());
      if (shift && key === 't') return run(reopenTab);
      if (shift && key === 'PageUp') return run(() => moveTab(active, -1));
      if (shift && key === 'PageDown') return run(() => moveTab(active, 1));
      if (key === '+' || (!shift && key === '=')) return run(() => zoom(0.1));
      if (!shift && key === '-') return run(() => zoom(-0.1));
      if (!shift && key === '0') return run(() => zoom(0));
    }

    if (!ctrl && !alt && !shift) {
      if (key === 'F5') return run(() => reload());
      if (key === 'F11') return run(toggleFullScreen);
    }
  };
}

// ---------- berichten van de schermen ----------
ipcMain.handle('get-state', () => state());

ipcMain.on('open', (_e, id) => {
  if (id === 'home' || views[id]) show(id);
});

ipcMain.on('add', (_e, service) => addTab(service));

ipcMain.on('back', () => {
  if (lastTab && views[lastTab]) show(lastTab);
});

ipcMain.on('palette-close', () => hidePalette());

ipcMain.on('palette-run', (_e, item) => {
  hidePalette();
  if (!item) return;
  if (item.type === 'tab' && views[item.id]) show(item.id);
  else if (item.type === 'add' && CATALOG[item.service]) addTab(item.service);
  else if (item.type === 'action' && ACTIONS[item.id]) ACTIONS[item.id]();
});

// Slepen in de tabbalk: tabblad naar een nieuwe plek (index) verplaatsen
ipcMain.on('reorder', (_e, id, to) => {
  const from = config.tabs.findIndex(t => t.id === id);
  if (from < 0 || typeof to !== 'number') return;
  if (from < to) to--; // na het weghalen schuift alles één plek op
  to = Math.max(0, Math.min(to, config.tabs.length - 1));
  if (from === to) return;
  const [tab] = config.tabs.splice(from, 1);
  config.tabs.splice(to, 0, tab);
  saveConfig();
  broadcast();
});

// Rechtsklikmenu op een tabblad
ipcMain.on('tab-menu', (_e, id) => {
  const i = config.tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  Menu.buildFromTemplate([
    { label: 'Herladen', accelerator: 'F5', click: () => reload(id) },
    { label: mutedTabs.has(id) ? 'Geluid aanzetten' : 'Geluid dempen', accelerator: 'Alt+M', click: () => toggleMute(id) },
    { type: 'separator' },
    { label: 'Naar links', accelerator: 'Ctrl+Shift+PageUp', enabled: i > 0, click: () => moveTab(id, -1) },
    { label: 'Naar rechts', accelerator: 'Ctrl+Shift+PageDown', enabled: i < config.tabs.length - 1, click: () => moveTab(id, 1) },
    { type: 'separator' },
    { label: 'Tabblad sluiten', accelerator: 'Ctrl+W', click: () => closeTab(id) }
  ]).popup({ window: win });
});

// Verwijderen (in het +-scherm): tabblad weg én uitloggen
ipcMain.on('remove', async (_e, id) => {
  const i = config.tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const part = partitionFor(config.tabs[i]);
  config.tabs.splice(i, 1);
  saveConfig();
  destroyView(id);
  if (lastTab === id) lastTab = null;
  // Login wissen, tenzij een ander tabblad dezelfde login gebruikt
  if (!config.tabs.some(t => partitionFor(t) === part)) {
    await session.fromPartition(part).clearStorageData();
  }
  if (active === id) active = 'home';
  show(active);
});

ipcMain.on('set-setting', (_e, key, value) => {
  if (!(key in DEFAULT_SETTINGS)) return;
  config.settings[key] = value;
  saveConfig();
  if (key === 'spellcheck') {
    for (const v of Object.values(views)) v.webContents.session.setSpellCheckerEnabled(value);
  }
  if (key === 'shareMicrosoft') {
    // Microsoft-tabbladen opnieuw laden met de nieuwe opslag
    for (const tab of config.tabs) {
      if (!CATALOG[tab.service].group) continue;
      destroyView(tab.id);
      createServiceView(tab);
    }
    layout();
  }
  broadcast();
});

// Eenmalige uitleg bij het eerste Microsoft-tabblad
async function showLoginNotice() {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Ingelogd blijven bij Microsoft',
    message: 'Tabchat kan je Microsoft-login onthouden',
    detail:
      'Microsoft en scholen gebruiken cookies die normaal verdwijnen zodra je de app sluit. ' +
      'Tabchat kan die cookies 14 dagen bewaren, zodat je niet elke keer opnieuw hoeft in te loggen.\n\n' +
      'Deze cookies blijven alleen op deze computer. Tabchat stuurt niets naar de maker of naar anderen.\n\n' +
      'Gebruik je een gedeelde computer? Kies dan "Niet onthouden". Je kunt dit later altijd wijzigen in het +-scherm.',
    buttons: ['Onthouden', 'Niet onthouden'],
    defaultId: 0,
    cancelId: 1
  });
  config.settings.stayLoggedIn = response === 0;
  config.loginNoticeShown = true;
  saveConfig();
  broadcast();
}

// ---------- venster ----------
function createWindow() {
  config = loadConfig();

  win = new BaseWindow({
    width: 1200,
    height: 800,
    title: 'Tabchat',
    autoHideMenuBar: true,
    backgroundColor: '#1e1f22',
    icon: path.join(__dirname, 'icon.png')
  });

  const prefs = { preload: path.join(__dirname, 'preload.js') };
  bar = new WebContentsView({ webPreferences: prefs });
  home = new WebContentsView({ webPreferences: prefs });
  palette = new WebContentsView({ webPreferences: prefs });
  palette.setBackgroundColor('#00000000'); // doorzichtig, zodat de app erachter zichtbaar blijft

  win.contentView.addChildView(bar);
  win.contentView.addChildView(home);
  bar.webContents.on('before-input-event', keyHandler('bar'));
  home.webContents.on('before-input-event', keyHandler('home'));
  palette.webContents.on('before-input-event', keyHandler('palette'));
  bar.webContents.loadFile(path.join(__dirname, 'tabs.html'));
  home.webContents.loadFile(path.join(__dirname, 'home.html'));
  palette.webContents.loadFile(path.join(__dirname, 'palette.html'));

  for (const tab of config.tabs) createServiceView(tab);
  win.contentView.addChildView(palette); // bovenop alles
  active = config.tabs.length ? config.tabs[0].id : 'home';
  if (active !== 'home') lastTab = active;

  win.on('resize', layout);
  win.on('focus', focusActive);
  home.webContents.on('focus', () => {
    if (active !== 'home' || paletteOpen) setImmediate(focusActive);
  });
  layout();

  // Sneltoetsen direct laten werken bij het opstarten:
  // eerst de tabbalk (laadt meteen), daarna het tabblad zodra dat klaar is
  bar.webContents.once('did-finish-load', () => {
    const target = active === 'home' ? home : views[active];
    if (target && target.webContents.isLoading()) bar.webContents.focus();
    else focusActive();
  });
  const first = active === 'home' ? home : views[active];
  if (first) first.webContents.once('dom-ready', () => focusActive());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', quit);
