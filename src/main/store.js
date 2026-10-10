// Gedeelde status van de app. Alle andere bestanden lezen en schrijven hier.
// Zo staat alles wat "nu" geldt op één plek.
module.exports = {
  win: null,      // het venster
  bar: null,      // de tabbalk bovenin
  home: null,     // het +-scherm
  palette: null,  // het snelzoekvenster (Ctrl+K)
  config: null,   // opgeslagen instellingen en tabbladen (zie config.js)

  views: {},              // tabblad-id -> scherm van die dienst
  active: 'home',         // wat er nu zichtbaar is: een tabblad-id of 'home'
  lastTab: null,          // laatst geopende tabblad (voor Esc in het +-scherm)
  paletteOpen: false,
  mutedTabs: new Set(),   // gedempte tabbladen (alleen deze sessie)
  closedTabs: [],         // gesloten tabbladen, voor Ctrl+Shift+T
  quitting: false         // true zodra de app echt afsluit (dan niet naar de tray)
};
