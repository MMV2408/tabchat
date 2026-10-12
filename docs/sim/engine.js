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
    // Zelfde aantallen als op de screenshots (sim/shots)
    tab('whatsapp', { unread: 45 }),
    tab('discord', { unread: 'dot' }),
    tab('teams', { unread: 2 }),
    tab('outlook'),
    tab('onedrive', { asleep: true, canSleep: true })
  ];
  let active = tabs[0].id;
  let lastTab = active;
  let dnd = null;         // null, 'forever' of een tijdstip (ms)
  let upd = 'idle';
  let menuHandler = null;
  let barHoverCb = null;

  // Het rechtsklikmenu van een tabblad, net als in de app (src/main/ipc.js)
  function menuItems(id) {
    const i = tabs.findIndex(t => t.id === id);
    if (i < 0) return [];
    const t = tabs[i];
    return [
      { label: T('menu.reload'), key: 'F5', act: 'reload' },
      { label: T(t.muted ? 'menu.unmute' : 'menu.mute'), key: 'Alt+M', act: 'mute' },
      null,
      { label: T('menu.sleepNow'), act: 'sleep', disabled: t.asleep },
      { label: T('menu.neverSleep'), act: 'never', checked: !t.canSleep },
      null,
      { label: T('menu.left'), key: 'Ctrl+Shift+PageUp', act: 'left', disabled: i === 0 },
      { label: T('menu.right'), key: 'Ctrl+Shift+PageDown', act: 'right', disabled: i === tabs.length - 1 },
      null,
      { label: T('menu.close'), key: 'Ctrl+W', act: 'close' }
    ];
  }
  function tabAction(id, act) {
    const i = tabs.findIndex(t => t.id === id);
    if (i < 0) return;
    const t = tabs[i];
    if (act === 'reload') { t.asleep = false; open(id); return; }
    if (act === 'mute') t.muted = !t.muted;
    if (act === 'sleep') { t.asleep = true; if (active === id) active = 'home'; }
    if (act === 'never') { t.canSleep = !t.canSleep; if (!t.canSleep) t.asleep = false; }
    if (act === 'left' && i > 0) [tabs[i - 1], tabs[i]] = [tabs[i], tabs[i - 1]];
    if (act === 'right' && i < tabs.length - 1) [tabs[i + 1], tabs[i]] = [tabs[i], tabs[i + 1]];
    if (act === 'close') {
      tabs.splice(i, 1);
      if (lastTab === id) lastTab = tabs[0] ? tabs[0].id : null;
      if (active === id) active = lastTab || 'home';
    }
    emit();
  }

  const lang = () => settings.language === 'auto' ? siteLang : settings.language;
  const T = (k, v = {}) => {
    let s = D.strings[lang()][k] ?? D.strings.nl[k] ?? k;
    for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b);
    return s;
  };

  // Labels zoals in de app: "Outlook", of "Outlook 1" en "Outlook 2" bij meer van dezelfde
  function labeled() {
    // Microsoft: labeltje School/werk of Privé, alleen als je ze allebei hebt (zoals in de app)
    const acct = (t) => { const g = D.catalog[t.service].group; return g === 'microsoft' ? 'work' : g === 'microsoft-personal' ? 'personal' : ''; };
    const kinds = new Set(tabs.map(acct));
    const both = kinds.has('work') && kinds.has('personal');
    return tabs.map(t => {
      const same = tabs.filter(x => x.service === t.service);
      const name = D.catalog[t.service].name;
      const label = same.length > 1 ? `${name} ${same.indexOf(t) + 1}` : name;
      const tag = t.temp ? 'temp' : both ? acct(t) : '';
      return { ...t, label, tag, fullLabel: label + (tag ? ` (${T('acct.' + tag)})` : ''), color: D.catalog[t.service].color };
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
      catalog: Object.entries(D.catalog).filter(([, c]) => !c.temp).map(([id, c]) => ({ id, name: c.name, key: c.key, color: c.color, base: c.base, askUrl: c.askUrl, custom: !!c.custom, icon: c.icon || null, school: !!c.school, url: c.url, desc: c.custom ? c.desc : T('svc.' + (c.base || id)) })),
      settings, dnd: dndState(),
      update: { state: upd, current: D.version, version: D.version },
      platform: { kind: 'deb', storeManaged: false },
      browsers: [{ id: 'firefox', name: 'Firefox' }, { id: 'chromium', name: 'Chromium' }],
      maximized: false,
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
      add: (service, url) => {
        if (D.catalog[service].askUrl && !url && !settings.brightspaceUrl) { f.ask.forEach(cb => cb(service)); return; }
        if (url && !settings.brightspaceUrl) settings.brightspaceUrl = url;
        const t = tab(service); tabs.push(t); open(t.id);
      },
      onAskUrl: (cb) => f.ask.push(cb),
      onFocusSetting: () => {},
      winControl: () => {},
      barHover: (inside) => { if (barHoverCb) barHoverCb(inside); },
      checkUrl: async (u) => {
        const s = String(u || '').trim();
        if (!/^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}/i.test(s)) return { status: 'invalid', url: null };
        await new Promise(r => setTimeout(r, 600)); // even "controleren"
        return { status: 'ok', url: (/^https?:/i.test(s) ? s : 'https://' + s).replace(/\/?$/, '/') };
      },
      checkSite: async (u) => {
        const s = String(u || '').trim();
        if (!/^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}/i.test(s)) return { status: 'invalid', url: null };
        await new Promise(r => setTimeout(r, 500));
        const url = (/^https?:/i.test(s) ? s : 'https://' + s).replace(/\/?$/, '/');
        const host = new URL(url).hostname.replace(/^www\./, '');
        const title = host.split('.')[0].replace(/^./, x => x.toUpperCase());
        return { status: /google\./.test(host) ? 'google' : 'ok', url, title, icon: null };
      },
      addCustom: (data, temp) => {
        const id = (temp ? 'temp-' : 'custom-') + Math.random().toString(36).slice(2, 8);
        let desc = ''; try { desc = new URL(data.url).hostname.replace(/^www\./, ''); } catch {}
        D.catalog[id] = { name: data.name, color: data.color, icon: data.icon, url: data.url, custom: true, temp: !!temp, school: !temp && data.school, desc, awake: false };
        const t = tab(id, temp ? { temp: true } : {}); tabs.push(t); open(t.id);
      },
      updateCustom: (id, data) => { const c = D.catalog[id]; if (c) { Object.assign(c, { name: data.name, color: data.color, icon: data.icon, url: data.url, school: data.school }); emit(); } },
      removeCustom: (id) => {
        tabs = tabs.filter(t => t.service !== id);
        delete D.catalog[id];
        settings.cardOrder = (settings.cardOrder || []).filter(x => x !== id);
        if (!tabs.some(t => t.id === lastTab)) lastTab = tabs[0] ? tabs[0].id : null;
        if (!tabs.some(t => t.id === active)) active = 'home';
        emit();
      },
      remove: (id) => {
        const gone = tabs.find(t => t.id === id);
        tabs = tabs.filter(t => t.id !== id);
        if (gone && gone.temp && !tabs.some(t => t.service === gone.service)) delete D.catalog[gone.service];
        if (lastTab === id) lastTab = tabs[0] ? tabs[0].id : null;
        if (active === id) active = 'home';
        emit();
      },
      back: () => { if (lastTab && tabs.some(t => t.id === lastTab)) open(lastTab); },
      tabMenu: (id) => { if (menuHandler) menuHandler(id, f.lastPos); },
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
      openFeedback: () => window.open('https://tally.so/r/LZAaop', '_blank', 'noopener'),
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
      const f = { win, state: [], keys: [], wn: [], ask: [], lastPos: null };
      frames.add(f);
      // Waar is rechts geklikt? (voor het tabblad-menu, dat de website tekent)
      win.addEventListener('contextmenu', (e) => { f.lastPos = { frame: win, x: e.clientX, y: e.clientY }; }, true);
      win.addEventListener('pagehide', () => frames.delete(f));
      applyTheme(win);
      return api(f);
    },
    onTabMenu(cb) { menuHandler = cb; },
    onBarHover(cb) { barHoverCb = cb; },
    menuItems, tabAction,
    subscribe(cb) { listeners.add(cb); cb(snapshot()); },
    open,
    showShortcuts() { open('home'); for (const f of frames) f.keys.forEach(cb => cb()); },
    setSite({ lang: l, theme: th }) { if (l) siteLang = l; if (th) siteTheme = th; emit(); },
    T
  };
})();
