// Simulatie van Tabchat op de website. De tabbalk en het +-scherm zijn de echte schermen van de app
// (sim/tabs.html en sim/home.html); dit bestand speelt "de app" voor ze: het onthoudt tabbladen,
// instellingen en Niet storen, en vertelt de pagina wat er in het venster moet staan.
(function () {
  const D = window.SIM_DATA;
  const frames = new Set();
  const listeners = new Set(); // de website zelf
  let siteLang = 'en', siteTheme = 'dark';
  let nextId = 1;

  const settings = { ...D.settings };
  const tab = (service, extra = {}) => ({ id: 't' + nextId++, service, canSleep: !D.catalog[service].awake, asleep: false, unread: 0, muted: false, ...extra });
  let tabs = [
    tab('whatsapp', { unread: 12 }),
    tab('discord', { unread: 'dot' }),
    tab('teams'),
    tab('outlook', { unread: 3 }),
    tab('onedrive', { asleep: true, canSleep: true })
  ];
  let active = tabs[0].id;
  let lastTab = active;
  let dnd = null;         // null, 'forever' of een tijdstip (ms)
  let upd = 'idle';

  const lang = () => settings.language === 'auto' ? siteLang : settings.language;
  const T = (k, v = {}) => {
    let s = D.strings[lang()][k] ?? D.strings.nl[k] ?? k;
    for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b);
    return s;
  };

  // Labels zoals in de app: "Outlook", of "Outlook 1" en "Outlook 2" bij meer van dezelfde
  function labeled() {
    return tabs.map(t => {
      const same = tabs.filter(x => x.service === t.service);
      const name = D.catalog[t.service].name;
      return { ...t, label: same.length > 1 ? `${name} ${same.indexOf(t) + 1}` : name, color: D.catalog[t.service].color };
    });
  }

  function dndState() {
    if (dnd && dnd !== 'forever' && dnd < Date.now()) dnd = null;
    if (!dnd) return { on: false, manual: false, label: null };
    let label;
    if (dnd === 'forever') label = T('dnd.untilOff');
    else {
      const d = new Date(dnd);
      const time = d.toLocaleTimeString(lang() === 'nl' ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
      label = T(d.toDateString() === new Date().toDateString() ? 'dnd.until' : 'dnd.untilTomorrow', { t: time });
    }
    return { on: true, manual: true, label };
  }

  function snapshot() {
    return JSON.parse(JSON.stringify({
      tabs: labeled(), active,
      catalog: Object.entries(D.catalog).map(([id, c]) => ({ id, name: c.name, key: c.key, color: c.color, desc: T('svc.' + id) })),
      settings, dnd: dndState(),
      update: { state: upd, current: D.version, version: D.version },
      platform: { kind: 'deb', storeManaged: false },
      browsers: [{ id: 'firefox', name: 'Firefox' }, { id: 'chromium', name: 'Chromium' }],
      lang: lang()
    }));
  }

  function themeFor() { return settings.theme === 'system' ? siteTheme : settings.theme; }
  function applyTheme(win) { try { win.document.documentElement.dataset.theme = themeFor(); } catch {} }

  function emit() {
    const s = snapshot();
    for (const f of frames) { applyTheme(f.win); f.state.forEach(cb => { try { cb(s); } catch {} }); }
    listeners.forEach(cb => cb(s));
  }

  function open(id) {
    if (id !== 'home' && !tabs.some(t => t.id === id)) return;
    active = id;
    if (id !== 'home') { lastTab = id; const t = tabs.find(x => x.id === id); t.asleep = false; }
    emit();
  }

  function api(f) {
    return {
      getState: async () => snapshot(),
      getStrings: async () => ({ strings: D.strings[lang()], lang: lang() }),
      onState: (cb) => f.state.push(cb),
      open,
      add: (service) => { const t = tab(service); tabs.push(t); open(t.id); },
      remove: (id) => {
        tabs = tabs.filter(t => t.id !== id);
        if (lastTab === id) lastTab = tabs[0] ? tabs[0].id : null;
        if (active === id) active = 'home';
        emit();
      },
      back: () => { if (lastTab && tabs.some(t => t.id === lastTab)) open(lastTab); },
      tabMenu: () => {},
      reorder: (id, to) => {
        const from = tabs.findIndex(t => t.id === id);
        if (from < 0) return;
        const [t] = tabs.splice(from, 1);
        tabs.splice(to > from ? to - 1 : to, 0, t);
        emit();
      },
      setTabSleep: (id, allowed) => { const t = tabs.find(x => x.id === id); if (t) { t.canSleep = allowed; if (!allowed) t.asleep = false; } emit(); },
      setSetting: (key, value) => { settings[key] = value; emit(); },
      setDnd: (mode) => {
        if (mode === null) dnd = null;
        else if (mode === 'forever') dnd = 'forever';
        else if (mode === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); dnd = d.getTime(); }
        else dnd = Date.now() + mode * 60000;
        emit();
      },
      onShowShortcuts: (cb) => f.keys.push(cb),
      checkUpdate: () => { upd = 'checking'; emit(); setTimeout(() => { upd = 'latest'; emit(); }, 900); },
      installUpdate: () => {},
      openDonate: () => window.open('https://github.com/sponsors/MMV2408', '_blank', 'noopener'),
      openWhatsNew: () => {
        const d = { updated: false, current: D.version, entries: D.changelog.slice(0, 4).map(e => ({ v: e.v, items: e[lang()] || e.en })) };
        f.wn.forEach(cb => cb(d));
      },
      whatsNewClosed: () => {},
      onWhatsNew: (cb) => f.wn.push(cb),
      onShareOpen: () => {}, sharePick: () => {}, shareCancel: () => {},
      onPaletteOpen: () => {}, paletteRun: () => {}, paletteClose: () => {}
    };
  }

  window.TabchatSim = {
    connect(win) {
      const f = { win, state: [], keys: [], wn: [] };
      frames.add(f);
      win.addEventListener('pagehide', () => frames.delete(f));
      applyTheme(win);
      return api(f);
    },
    subscribe(cb) { listeners.add(cb); cb(snapshot()); },
    open,
    showShortcuts() { open('home'); for (const f of frames) f.keys.forEach(cb => cb()); },
    setSite({ lang: l, theme: th }) { if (l) siteLang = l; if (th) siteTheme = th; emit(); },
    T
  };
})();
