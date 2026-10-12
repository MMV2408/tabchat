// Your own websites: any site as a tab, with its own card on the + screen.
// They live in config.custom and are added to CATALOG on startup, so from then on
// they work like a built-in service everywhere (tab, counter, notifications, sleep, Ctrl+K).
// Incognito: a temporary tab that saves nothing (no card, no login, gone after closing).
const { net } = require('electron');
const { CATALOG, normalizeUrl, hostOf } = require('./catalog');
const log = require('./log');

const MAX_ICON = 150 * 1024; // icons larger than this are not stored

// Add one of your own websites to CATALOG as a service
function register(c) {
  if (!c || !c.id || !c.url) return;
  const host = hostOf(c.url).replace(/^www\./, '');
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

// Shortcut (Alt+letter on the + screen): the first letter of the name that is still free.
// T and M are taken by Alt+T (+ screen) and Alt+M (mute). No free letter? Then no shortcut.
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

// Google (Gmail, Drive, YouTube sign-in) blocks signing in from apps like Tabchat
const isGoogle = (host) => /(^|\.)google\.[a-z.]+$|(^|\.)gmail\.com$|(^|\.)youtube\.com$/i.test(host);

async function get(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await net.fetch(url, { signal: ctrl.signal, redirect: 'follow' }); }
  finally { clearTimeout(timer); }
}

// The site's icon as a data URL (from <link rel="icon">, otherwise /favicon.ico)
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
    } catch (e) {
      log.info('icon fetch failed:', u, e.message); // try the next candidate
    }
  }
  return null;
}

// Check for the green check mark: { status: 'ok' | 'google' | 'notFound' | 'error' | 'invalid', url, title, icon }
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

// Cleaned-up data from the form
function clean(data) {
  const url = normalizeUrl(data && data.url);
  if (!url) return null;
  const color = /^#[0-9a-f]{6}$/i.test(data.color || '') ? data.color : '#5865F2';
  const icon = typeof data.icon === 'string' && data.icon.startsWith('data:image/') && data.icon.length < MAX_ICON * 1.4 ? data.icon : null;
  const name = String(data.name || '').trim().slice(0, 30);
  return { url, color, icon, name, school: !!data.school };
}

module.exports = { register, registerAll, unregister, newId, check, clean, get, fetchIcon };
