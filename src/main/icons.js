// Echte logo's voor de vaste diensten in het +-scherm.
// We halen het icoontje één keer op bij de dienst zelf en bewaren het in de config.
// Lukt dat niet (offline, site geblokkeerd), dan blijft de gekleurde letter staan.
const { CATALOG } = require('./catalog');
const store = require('./store');

// Per dienst: adressen om te proberen. Een adres op /favicon.ico wordt direct opgehaald,
// anders lezen we de pagina en zoeken we het icoon in <link rel="icon">.
const SOURCES = {
  whatsapp: ['https://web.whatsapp.com/favicon.ico', 'https://www.whatsapp.com/'],
  discord: ['https://discord.com/favicon.ico', 'https://discord.com/'],
  outlook: ['https://outlook.live.com/favicon.ico', 'https://outlook.office.com/favicon.ico'],
  onedrive: ['https://onedrive.live.com/favicon.ico'],
  teams: ['https://teams.microsoft.com/favicon.ico', 'https://teams.live.com/favicon.ico']
};

// Waar het icoon van komt; verandert dit (ander Brightspace-adres), dan halen we het opnieuw
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
    } catch {}
  }
  return null;
}

// Bewaarde icoontjes in CATALOG zetten (ook voor de privé-varianten van Microsoft)
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
      if (!icon) continue; // volgende start opnieuw proberen
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

// Bij het starten: eerst de bewaarde tonen, daarna (rustig) ontbrekende ophalen
function start() {
  apply();
  setTimeout(refresh, 4000);
}

module.exports = { start, refresh, apply };
