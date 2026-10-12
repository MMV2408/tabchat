// Wat is er nieuw: per versie een korte lijst, in het Nederlands en Engels.
// Nieuwe versie? Zet bovenaan een blok erbij (en in packaging/flatpak/...metainfo.xml).
const CHANGELOG = [
  {
    v: '1.19.0',
    nl: ['Eigen websites: voeg elke website toe als tabblad, met naam, icoon en kleur. Ze krijgen het label Eigen en je wijzigt ze met ✎',
         'Incognito: open een website één keer, zonder dat er iets bewaard blijft',
         'Kies zelf welke vaste diensten je ziet (Diensten kiezen) en sleep de kaarten in je eigen volgorde',
         'Echte logo\'s op de kaarten in het +-scherm'],
    en: ['Your own websites: add any website as a tab, with its own name, icon and color. They get an Own label and you edit them with ✎',
         'Incognito: open a website once, without anything being saved',
         'Choose which built-in services you see (Choose services) and drag the cards into your own order']
  },
  {
    v: '1.18.0',
    nl: ['Strakker venster: de tabbalk is nu de titelbalk (slepen, − □ ✕), dus de aparte Ubuntu-balk is weg',
         'Tabbalk compact (alleen icoontjes) of automatisch verbergen: hij verschijnt als je de muis naar boven beweegt of op Alt drukt (+ scherm → Tabbalk)'],
    en: ['Cleaner window: the tab bar is now the title bar (drag, − □ ✕), so the separate Ubuntu bar is gone',
         'Compact tab bar (icons only) or auto-hide: it appears when you move the mouse to the top or press Alt (+ screen → Tab bar)']
  },
  {
    v: '1.17.0',
    nl: ['Brightspace van je school als tabblad, ingelogd met hetzelfde schoolaccount als Teams en Outlook. Het adres vul je één keer in het +-scherm in; een groen vinkje laat zien dat het werkt'],
    en: ["Your school's Brightspace as a tab, signed in with the same school account as Teams and Outlook. Enter its address once on the + screen; a green check shows it works"]
  },
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
