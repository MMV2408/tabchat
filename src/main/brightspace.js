// Controleren of een adres een werkende Brightspace is (voor het groene vinkje in het +-scherm).
// Brightspace heeft een openbaar adres /d2l/api/versions/ dat zonder inloggen een lijstje versies geeft.
// Lukt dat niet (sommige scholen schermen het af), dan kijken we of de pagina naar /d2l/ leidt.
const { net } = require('electron');
const { normalizeUrl } = require('./catalog');

async function get(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await net.fetch(url, { signal: ctrl.signal, redirect: 'follow' }); }
  finally { clearTimeout(timer); }
}

// Uitkomst: { status: 'ok' | 'notBrightspace' | 'notFound' | 'error' | 'invalid', url }
async function check(input) {
  const url = normalizeUrl(input);
  if (!url) return { status: 'invalid', url: null };
  const origin = new URL(url).origin;
  try {
    const r = await get(origin + '/d2l/api/versions/');
    if (r.ok) {
      const data = await r.json().catch(() => null);
      if (Array.isArray(data) && data.some(v => v && v.ProductCode)) return { status: 'ok', url };
    }
    const page = await get(url);
    const text = (await page.text().catch(() => '')).slice(0, 200000);
    if (/\/d2l\//i.test(page.url) || /d2l|brightspace/i.test(text)) return { status: 'ok', url };
    return { status: 'notBrightspace', url };
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/NAME_NOT_RESOLVED|ENOTFOUND/i.test(msg)) return { status: 'notFound', url };
    return { status: 'error', url };
  }
}

module.exports = { check };
