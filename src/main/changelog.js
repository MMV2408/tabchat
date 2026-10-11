// Wat is er nieuw: per versie een korte lijst, in het Nederlands en Engels.
// Nieuwe versie? Zet bovenaan een blok erbij (en in packaging/flatpak/...metainfo.xml).
const CHANGELOG = [
  {
    v: '1.12.0',
    nl: ['Dit scherm: na elke update zie je meteen wat er nieuw is'],
    en: ['This screen: after every update you see right away what is new']
  },
  {
    v: '1.11.4',
    nl: ['Klik op de update-melding en je komt direct bij de knop Nu installeren',
         'Kies je een tabblad in het tray-menu, dan komt Tabchat altijd naar voren'],
    en: ['Click the update notification to go straight to the Install now button',
         'Choosing a tab from the tray menu always brings Tabchat to the front']
  },
  {
    v: '1.11.2',
    nl: ['Diensten wisselen meteen mee als het thema verandert', 'Een verkeerde "bijgewerkt"-melding opgelost'],
    en: ['Services switch along right away when the theme changes', 'Fixed a wrong "updated" notification']
  },
  {
    v: '1.11.0',
    nl: ['Licht thema dat Ubuntu volgt (Thema in het + scherm)',
         'Zet je Niet storen aan in Ubuntu, dan is Tabchat ook stil',
         'Klik op een melding en je zit meteen in het juiste tabblad'],
    en: ['Light theme that follows Ubuntu (Theme on the + screen)',
         'When Do not disturb is on in Ubuntu, Tabchat stays quiet too',
         'Click a notification to jump straight to the right tab']
  },
  {
    v: '1.10.0',
    nl: ['Tabchat in het Nederlands en Engels', 'Donkere scrollbalken'],
    en: ['Tabchat in Dutch and English', 'Dark scrollbars']
  }
];

// Is versie a nieuwer dan b? (bv. '1.11.1' > '1.11.0')
function newer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

// Versies na "from" (of de laatste paar als from leeg is), in de gekozen taal
function since(from, lang, max = 5) {
  return CHANGELOG
    .filter(e => !from || newer(e.v, from))
    .slice(0, max)
    .map(e => ({ v: e.v, items: e[lang] || e.en }));
}

module.exports = { CHANGELOG, newer, since };
