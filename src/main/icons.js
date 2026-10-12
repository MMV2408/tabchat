// Real logos for the built-in services on the + screen.
// We fetch the icon once from the service itself and store it in the config.
// If that fails (offline, site blocked), the colored letter stays.
const { CATALOG } = require('./catalog');
const store = require('./store');
const log = require('./log');

// Per service: addresses to try. An address ending in /favicon.ico is fetched directly,
// otherwise we read the page and look for the icon in <link rel="icon">.
const SOURCES = {
  whatsapp: ['https://web.whatsapp.com/favicon.ico', 'https://www.whatsapp.com/'],
  discord: ['https://discord.com/favicon.ico', 'https://discord.com/'],
  outlook: ['https://outlook.live.com/favicon.ico', 'https://outlook.office.com/favicon.ico'],
  onedrive: ['https://onedrive.live.com/favicon.ico'],
  teams: ['https://teams.microsoft.com/favicon.ico', 'https://teams.live.com/favicon.ico']
};

// Where the icon comes from; if this changes (other Brightspace address), we fetch it again
function sourceKey(id) {
  if (id === 'brightspace') return store.config.settings.brightspaceUrl || '';
  return (SOURCES[id] || []).join(' ');
}
function sourcesFor(id) {
  if (id === 'brightspace') return sourceKey(id) ? [sourceKey(id)] : [];
  return SOURCES[id] || [];
}

async function fetchFor(id) {
  const { get, fetchIcon } = require('./custom');
  for (const u of sourcesFor(id)) {
    try {
      if (/\/favicon\.ico$/.test(u)) {
        const icon = await fetchIcon(u, '');
        if (icon) return icon;
        continue;
      }
      const r = await get(u);
      if (!r.ok) continue;
      const icon = await fetchIcon(r.url || u, await r.text());
      if (icon) return icon;
    } catch (e) {
      log.info('logo fetch failed:', id, u, e.message); // try the next source
    }
  }
  return null;
}

// Put stored icons in CATALOG (also for the personal Microsoft variants)
function apply() {
  const cache = store.config.icons || {};
  for (const [id, c] of Object.entries(CATALOG)) {
    if (c.custom) continue;
    const e = cache[c.base || id];
    c.icon = e && e.from === sourceKey(c.base || id) ? e.icon : null;
  }
}

let busy = false;
async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const cache = store.config.icons = store.config.icons || {};
    let changed = false;
    for (const id of Object.keys(CATALOG)) {
      const c = CATALOG[id];
      if (c.custom || c.base) continue;
      const from = sourceKey(id);
      if (!from || (cache[id] && cache[id].from === from && cache[id].icon)) continue;
      const icon = await fetchFor(id);
      if (!icon) continue; // try again on the next start
      cache[id] = { from, icon };
      changed = true;
    }
    apply();
    if (changed) {
      require('./config').save();
      require('./views').broadcast();
    }
  } finally { busy = false; }
}

// On startup: show the stored ones first, then (calmly) fetch the missing ones
function start() {
  apply();
  setTimeout(refresh, 4000);
}

module.exports = { start, refresh, apply };
