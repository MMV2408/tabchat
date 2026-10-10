// Alle diensten die een gebruiker kan toevoegen, en de bijbehorende webadressen.
// Een nieuwe dienst toevoegen = één regel in CATALOG.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// key   = letter voor Alt+letter in het +-scherm
// group = diensten in dezelfde groep kunnen één login delen (zie microsoft.js)
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

function serviceByKey(key) {
  return Object.keys(CATALOG).find(s => CATALOG[s].key === key);
}

module.exports = { UA, CATALOG, LOGIN_HOSTS, isMsAppHost, serviceByKey };
