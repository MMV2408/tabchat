// What's new: a short list per version, in Dutch and English.
// New version? Add a block at the top (and in packaging/flatpak/...metainfo.xml).
const CHANGELOG = [
  {
    v: '1.27.0',
    nl: ['Zuinige modus: Tabchat gebruikt ongeveer 20% minder geheugen (gemeten met WhatsApp, Discord en Teams: van 1,6 naar 1,25 GB). Staat standaard aan, uit te zetten bij Instellingen → Algemeen',
         '"Nu herstarten" (na het wijzigen van een instelling) start Tabchat nu altijd weer op'],
    en: ['Saving mode: Tabchat uses about 20% less memory (measured with WhatsApp, Discord and Teams: from 1.6 to 1.25 GB). On by default, can be turned off under Settings → General',
         '"Restart now" (after changing a setting) now always starts Tabchat again']
  },
  {
    v: '1.26.0',
    nl: ['Downloads: je ziet de voortgang rechtsboven (⬇), en op het + scherm staat een lijst met je laatste downloads om te openen of in de map te tonen',
         'PDF\'s openen in een eigen Tabchat-venster om te lezen, zoeken en printen (uit te zetten bij Instellingen → Algemeen)',
         'Na een update verschijnt er een knop "✨ Nieuw in …" in de tabbalk in plaats van een venster dat vanzelf opent',
         'Typ "WhatsApp", "Teams" of "Discord" in je app-menu en Tabchat verschijnt',
         'Voorbereid voor Arch Linux (AUR): daar regelt je pakketbeheerder de updates'],
    en: ['Downloads: see the progress in the top right (⬇), and the + screen lists your latest downloads to open or show in their folder',
         'PDFs open in a Tabchat window to read, search and print (can be turned off under Settings → General)',
         'After an update a "✨ New in …" button appears in the tab bar instead of a window that opens by itself',
         'Type "WhatsApp", "Teams" or "Discord" in your app menu and Tabchat shows up',
         'Ready for Arch Linux (AUR): there your package manager handles the updates']
  },
  {
    v: '1.25.1',
    nl: ['Snel zoeken (Ctrl+K) kon onzichtbaar open blijven staan, waardoor je nergens meer op kon klikken: opgelost. Esc sluit het nu altijd',
         'Reageert een tabblad of Tabchat zelf niet meer, dan kun je wachten, dat deel opnieuw starten of het probleem melden'],
    en: ['Quick search (Ctrl+K) could stay open but invisible, so nothing could be clicked: fixed. Esc now always closes it',
         'If a tab or Tabchat itself stops responding, you can wait, restart that part or report the problem']
  },
  {
    v: '1.25.0',
    nl: ['Meldingen worden nu verstuurd door een klein eigen programma in Rust in plaats van een JavaScript-proces: zo\'n 30 MB minder geheugen en sneller',
         'In een smal venster passen de knoppen op het + scherm weer netjes in hun kaart'],
    en: ['Notifications are now sent by a small native program written in Rust instead of a JavaScript process: about 30 MB less memory and faster',
         'In a narrow window the buttons on the + screen fit their card again']
  },
  {
    v: '1.24.0',
    nl: ['Zuiniger: minder processen op de achtergrond, zo\'n 25 tot 40 MB minder geheugen',
         'Op het + scherm zie je per tabblad hoeveel geheugen het gebruikt, plus het totaal',
         'Onderaan uitleg waarom je taakbeheerder een ander getal laat zien',
         'Op computers met 8 GB of minder (zoals een Raspberry Pi) staat de slaapstand standaard aan bij een nieuwe installatie. Chat-apps blijven wakker',
         'Inloggen bij Microsoft blijft niet meer hangen op "Gezicht, vingerafdruk, pincode of beveiligingssleutel": je krijgt dan wachtwoord of de Authenticator-app'],
    en: ['Lighter: fewer background processes, about 25 to 40 MB less memory',
         'The + screen shows how much memory each tab uses, plus the total',
         'At the bottom: why your task manager shows a different number',
         'On computers with 8 GB or less (like a Raspberry Pi) tab sleep is on by default for new installs. Chat apps stay awake',
         'Microsoft sign-in no longer hangs on "Face, fingerprint, PIN or security key": you get password or the Authenticator app instead']
  },
  {
    v: '1.23.0',
    nl: ['Tabchat draait nu ook op ARM-computers (64-bit), zoals de Raspberry Pi 4 en 5',
         'Bijgewerkt naar de nieuwste browser-engine (Electron 44, Chrome 152): veiliger, en Brightspace meldt niet meer dat je browser verouderd is'],
    en: ['Tabchat now also runs on ARM computers (64-bit), like the Raspberry Pi 4 and 5',
         'Updated to the latest browser engine (Electron 44, Chrome 152): more secure, and Brightspace no longer says your browser is outdated']
  },
  {
    v: '1.22.0',
    nl: ['Gesplitst scherm: twee tabbladen naast elkaar (rechtsklik → Naast elkaar openen, of Ctrl+\\). Sleep de lijn om te verdelen, ✕ om te stoppen',
         'Terug, vooruit, herladen en startpagina bij het actieve tabblad, en de zijknoppen van je muis werken',
         'Zoeken op de pagina met Ctrl+F',
         'Rechtsklik op een tabblad: dupliceren met dezelfde login, adres kopiëren en openen in browser',
         'Downloads gaan direct naar je map Downloads, met een melding om de map te openen',
         'Bij een automatisch verborgen tabbalk blijft de balk open terwijl je een tabblad sleept'],
    en: ['Split view: two tabs side by side (right-click → Open side by side, or Ctrl+\\). Drag the line to resize, ✕ to stop',
         'Back, forward, reload and start page on the active tab, and the side buttons on your mouse work',
         'Find on page with Ctrl+F',
         'Right-click a tab: duplicate with the same sign-in, copy address and open in browser',
         'Downloads go straight to your Downloads folder, with a notification to open the folder',
         'With an auto-hidden tab bar, the bar stays open while you drag a tab']
  },
  {
    v: '1.21.0',
    nl: ['Fouten waar Tabchat zelf mee verder kan, worden nu bijgehouden in ~/.config/tabchat/tabchat.log in plaats van stil genegeerd. Handig om mee te sturen als er iets niet werkt',
         'Opgeruimde code: commentaar in het Engels, zodat anderen makkelijker kunnen meelezen en bijdragen'],
    en: ["Errors Tabchat can recover from are now kept in ~/.config/tabchat/tabchat.log instead of being silently ignored. Handy to send along when something doesn't work",
         'Cleaned-up code: comments in English, so others can read along and contribute more easily']
  },
  {
    v: '1.20.3',
    nl: ['Nu installeren: geen vraag meer van Ubuntu om Tabchat geforceerd af te sluiten terwijl je je wachtwoord invult'],
    en: ['Install now: Ubuntu no longer asks to force quit Tabchat while you enter your password']
  },
  {
    v: '1.20.2',
    nl: ['Lukt het installeren van een update niet, dan zie je dat nu in het +-scherm, en houdt Tabchat een logboek bij (updater.log) dat je kunt meesturen'],
    en: ["If installing an update doesn't work, you now see it on the + screen, and Tabchat keeps a log (updater.log) you can send along"]
  },
  {
    v: '1.20.1',
    nl: ['Hardwareversnelling staat nu bij Algemeen, als hulp bij beeldproblemen (zwart scherm of flikkeren). Geheugen scheelt het nauwelijks, dus laat hem gewoon aan als alles goed werkt'],
    en: ['Hardware acceleration moved to General, as a fix for display problems (black screen or flickering). It barely saves memory, so just leave it on if everything works']
  },
  {
    v: '1.20.0',
    nl: ['Nieuwe instelling Hardwareversnelling'],
    en: ['New setting Hardware acceleration']
  },
  {
    v: '1.19.2',
    nl: ['Zuiniger met geheugen: het +-scherm, snelzoeken (Ctrl+K), scherm delen en de meldingen laden pas als je ze nodig hebt en ruimen zichzelf weer op (ongeveer 300 MB minder)'],
    en: ['Uses less memory: the + screen, quick search (Ctrl+K), screen sharing and notifications load only when needed and clean up after themselves (about 300 MB less)']
  },
  {
    v: '1.19.1',
    nl: ['Functies in het +-scherm netjes verdeeld over tabjes: Algemeen, Accounts, Meldingen, Opstarten en Geheugen'],
    en: ['Features on the + screen neatly split into tabs: General, Accounts, Notifications, Startup and Memory']
  },
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

// Is version a newer than b? (e.g. '1.11.1' > '1.11.0')
function newer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

// Versions after "from" (or the last few if from is empty), in the chosen language
function since(from, lang, max = 5) {
  return CHANGELOG
    .filter(e => !from || newer(e.v, from))
    .slice(0, max)
    .map(e => ({ v: e.v, items: e[lang] || e.en }));
}

module.exports = { CHANGELOG, newer, since };
