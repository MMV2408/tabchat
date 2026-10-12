// Alle diensten die een gebruiker kan toevoegen, en de bijbehorende webadressen.
// Een nieuwe dienst toevoegen = één regel in CATALOG.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// key   = letter voor Alt+letter in het +-scherm
// group = diensten in dezelfde groep kunnen één login delen (zie microsoft.js)
// awake = standaard nooit in slaapstand (chat-apps, zodat je geen berichten mist)
// askUrl = het adres verschilt per school/organisatie: bij toevoegen vraagt Tabchat erom (tab.url)
// base  = privé-variant van een dienst: in het +-scherm een tweede knop op de kaart van 'base'.
//         Microsoft heeft voor privé-accounts (Outlook.com, Hotmail, Live) aparte websites.
const CATALOG = {
  whatsapp: { name: 'WhatsApp', key: 'w', url: 'https://web.whatsapp.com',               color: '#25D366', desc: 'Chatten met je telefoonnummer', awake: true },
  discord:  { name: 'Discord',  key: 'd', url: 'https://discord.com/app',                color: '#5865F2', desc: 'Servers, vrienden en spraak', awake: true },
  brightspace: { name: 'Brightspace', key: 'b', url: null, askUrl: true, settingUrl: 'brightspaceUrl', color: '#E8642C', desc: 'De studieomgeving van je school', group: 'microsoft' },
  outlook:  { name: 'Outlook',  key: 'o', url: 'https://outlook.office.com/mail/',       color: '#0078D4', desc: 'E-mail en agenda', group: 'microsoft' },
  onedrive: { name: 'OneDrive', key: 'n', url: 'https://www.office.com/launch/onedrive', color: '#0364B8', desc: 'Je bestanden in de cloud', group: 'microsoft' },
  teams:    { name: 'Teams',    key: 't', url: 'https://teams.microsoft.com',            color: '#6264A7', desc: 'School en werk (Microsoft)', group: 'microsoft', awake: true },
  'teams-personal':    { name: 'Teams',    base: 'teams',    url: 'https://teams.live.com',           color: '#6264A7', group: 'microsoft-personal', awake: true },
  'outlook-personal':  { name: 'Outlook',  base: 'outlook',  url: 'https://outlook.live.com/owa/?nlp=1', color: '#0078D4', group: 'microsoft-personal' },
  'onedrive-personal': { name: 'OneDrive', base: 'onedrive', url: 'https://onedrive.live.com/login/', color: '#0364B8', group: 'microsoft-personal' }
};

// Inlogvensters die binnen de app mogen openen in plaats van in de browser
const LOGIN_HOSTS = [
  'login.microsoftonline.com', 'login.microsoft.com', 'login.live.com',
  'teams.microsoft.com', 'teams.live.com', 'outlook.office.com', 'outlook.live.com',
  'www.microsoft365.com', 'www.office.com', 'onedrive.live.com',
  // privé-accounts (Outlook.com, Hotmail, Live)
  'signup.live.com', 'account.live.com', 'outlook.com', 'www.outlook.com', 'onedrive.com', 'www.onedrive.com'
];

// Domeinen van de Microsoft-apps zelf. Alles daarbuiten (login.microsoftonline.com,
// de inlogpagina van je school zoals die van de HvA) telt als "inlogscherm".
const MS_APP_DOMAINS = [
  'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft',
  'outlook.office.com', 'outlook.office365.com', 'outlook.live.com', 'outlook.cloud.microsoft',
  'microsoft365.com', 'office.com', 'sharepoint.com', 'onedrive.live.com', 'onedrive.com', 'cloud.microsoft'
];

function isMsAppHost(host) {
  return MS_APP_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

// Het adres van een tabblad: eigen adres (bv. Brightspace van je school) of dat van de dienst
function urlFor(tab) {
  const svc = CATALOG[tab.service];
  if (tab.url) return tab.url;
  if (svc.settingUrl) {
    const s = require('./store').config.settings[svc.settingUrl];
    if (s) return s;
  }
  return svc.url;
}

// Hoort dit adres bij de dienst zelf (en is het dus geen inlogscherm)?
function isOwnHost(tab, host) {
  const u = urlFor(tab);
  if (!u || !CATALOG[tab.service].askUrl) return false;
  try { const own = new URL(u).hostname; return host === own || host.endsWith('.' + own); } catch { return false; }
}

// Wat iemand intypt ("dlo.mijnhva.nl", "https://...") netjes maken; null als het geen webadres is
function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || /\s/.test(u.hostname)) return null;
    return u.origin + (u.pathname === '/' ? '/' : u.pathname) + u.search;
  } catch { return null; }
}

function serviceByKey(key) {
  return Object.keys(CATALOG).find(s => CATALOG[s].key && CATALOG[s].key === key);
}

module.exports = { UA, CATALOG, LOGIN_HOSTS, isMsAppHost, serviceByKey, urlFor, isOwnHost, normalizeUrl };
