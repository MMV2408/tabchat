// Wat is er nieuw: per versie een korte lijst, in het Nederlands en Engels.
// Nieuwe versie? Zet bovenaan een blok erbij (en in packaging/flatpak/...metainfo.xml).
const CHANGELOG = [
  {
    v: '1.16.0',
    nl: ['Feedback geven: een link in het +-scherm, en na een week één keer de vraag hoe Tabchat bevalt. Er wordt niets automatisch verstuurd'],
    en: ['Give feedback: a link on the + screen, and after a week a one-time question about how Tabchat is working for you. Nothing is sent automatically']
  },
  {
    v: '1.15.0',
    nl: ['Privé-accounts van Microsoft (Outlook.com, Hotmail, Live): kies bij Teams, Outlook en OneDrive voor School/werk of Privé. Ze staan naast elkaar, elk met een eigen login'],
    en: ['Personal Microsoft accounts (Outlook.com, Hotmail, Live): pick Work/school or Personal for Teams, Outlook and OneDrive. They sit side by side, each with its own sign-in']
  },
  {
    v: '1.14.1',
    nl: ['Ook in de Snap Store-versie laadt de muis niet meer na een klik op een melding'],
    en: ['The Snap Store version no longer shows a loading cursor after clicking a notification either']
  },
  {
    v: '1.14.0',
    nl: ['Na een klik op een melding blijft de muis niet meer 15 seconden laden: meldingen gaan nu via Ubuntu zelf'],
    en: ['No more 15-second loading cursor after clicking a notification: notifications now go through Ubuntu itself']
  },
  {
    v: '1.13.0',
    nl: ['Kies waar links openen: je standaardbrowser, een andere browser (Firefox, Chrome, ...) of Tabchat zelf (+ scherm → Links openen in)',
         'Links in Outlook-mails openen nu altijd'],
    en: ['Choose where links open: your default browser, another browser (Firefox, Chrome, ...) or Tabchat itself (+ screen → Open links in)',
         'Links in Outlook mails now always open']
  },
  {
    v: '1.12.2',
    nl: ['Installatie van een update geannuleerd? Geen foutmelding meer, de update staat de volgende keer weer klaar',
         'Geen foutvenster meer tijdens het afsluiten'],
    en: ['Cancelled an update installation? No more error, the update is ready again next time',
         'No more error window while closing']
  },
  {
    v: '1.12.1',
    nl: ['Na een klik op een melding blijft de muis niet meer eindeloos laden'],
    en: ['No more endless loading cursor after clicking a notification']
  },
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
