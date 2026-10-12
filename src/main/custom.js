// Eigen websites: elke site als tabblad, met een eigen kaart in het +-scherm.
// Ze staan in config.custom en worden bij het starten aan CATALOG toegevoegd, zodat ze verder
// overal werken als een vaste dienst (tabblad, teller, meldingen, slaapstand, Ctrl+K).
// Incognito: een tijdelijk tabblad dat niets bewaart (geen kaart, geen login, weg na sluiten).
const { net } = require('electron');
const { CATALOG, normalizeUrl } = require('./catalog');

const MAX_ICON = 150 * 1024; // icoontjes groter dan dit slaan we niet op

// Een eigen website als dienst toevoegen aan CATALOG
function register(c) {
  if (!c || !c.id || !c.url) return;
  let host = '';
  try { host = new URL(c.url).hostname.replace(/^www\./, ''); } catch {}
  CATALOG[c.id] = {
    name: c.name || host || 'Website',
    url: c.url,
    color: c.color || '#5865F2',
    icon: c.icon || null,
    custom: true,
    temp: !!c.temp,
    key: c.temp ? '' : freeKey(c.id, c.name || host),
    desc: host,
    group: c.school ? 'microsoft' : undefined
  };
}

// Sneltoets (Alt+letter in het +-scherm): de eerste letter uit de naam die nog vrij is.
// T en M zijn al van Alt+T (+-scherm) en Alt+M (geluid uit). Geen vrije letter? Dan geen sneltoets.
const RESERVED = ['t', 'm'];
function freeKey(id, name) {
  const used = new Set(RESERVED);
  for (const [other, s] of Object.entries(CATALOG)) if (other !== id && s.key) used.add(s.key);
  for (const ch of String(name).toLowerCase()) if (/[a-z]/.test(ch) && !used.has(ch)) return ch;
  return '';
}

function registerAll(list) {
  for (const c of Array.isArray(list) ? list : []) register(c);
}

function unregister(id) {
  if (CATALOG[id] && CATALOG[id].custom) delete CATALOG[id];
}

const newId = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 8);

// Google (Gmail, Drive, YouTube-login) blokkeert inloggen in apps zoals Tabchat
const isGoogle = (host) => /(^|\.)google\.[a-z.]+$|(^|\.)gmail\.com$|(^|\.)youtube\.com$/i.test(host);

async function get(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await net.fetch(url, { signal: ctrl.signal, redirect: 'follow' }); }
  finally { clearTimeout(timer); }
}

// Icoontje van de site als data-URL (uit <link rel="icon">, anders /favicon.ico)
async function fetchIcon(pageUrl, html) {
  const tried = [];
  const m = [...String(html).matchAll(/<link\b[^>]*>/gi)].map(x => x[0])
    .filter(tag => /rel=["']?[^"'>]*\bicon\b/i.test(tag))
    .map(tag => (tag.match(/href=["']?([^"' >]+)/i) || [])[1]).filter(Boolean);
  for (const href of [...m, '/favicon.ico']) {
    let u;
    try { u = new URL(href, pageUrl).href; } catch { continue; }
    if (tried.includes(u)) continue;
    tried.push(u);
    try {
      const r = await get(u, 5000);
      if (!r.ok) continue;
      const type = (r.headers.get('content-type') || '').split(';')[0].trim();
      if (!/^image\//.test(type) && !/\.(ico|png|svg|jpg|jpeg|gif|webp)(\?|$)/i.test(u)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > MAX_ICON) continue;
      return `data:${type || 'image/x-icon'};base64,${buf.toString('base64')}`;
    } catch {}
  }
  return null;
}

// Controleren voor het groene vinkje: { status: 'ok' | 'google' | 'notFound' | 'error' | 'invalid', url, title, icon }
async function check(input) {
  const url = normalizeUrl(input);
  if (!url) return { status: 'invalid', url: null };
  const host = new URL(url).hostname;
  try {
    const r = await get(url);
    const html = (await r.text().catch(() => '')).slice(0, 300000);
    const title = ((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const icon = await fetchIcon(r.url || url, html);
    return { status: isGoogle(host) ? 'google' : 'ok', url, title, icon };
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/NAME_NOT_RESOLVED|ENOTFOUND/i.test(msg)) return { status: 'notFound', url };
    return { status: isGoogle(host) ? 'google' : 'error', url };
  }
}

// Opgeschoonde gegevens uit het formulier
function clean(data) {
  const url = normalizeUrl(data && data.url);
  if (!url) return null;
  const color = /^#[0-9a-f]{6}$/i.test(data.color || '') ? data.color : '#5865F2';
  const icon = typeof data.icon === 'string' && data.icon.startsWith('data:image/') && data.icon.length < MAX_ICON * 1.4 ? data.icon : null;
  const name = String(data.name || '').trim().slice(0, 30);
  return { url, color, icon, name, school: !!data.school };
}

module.exports = { register, registerAll, unregister, newId, check, clean, get, fetchIcon };
