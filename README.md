# Tabchat

WhatsApp, Discord, Teams, Outlook en OneDrive in één venster, voor Linux.
Onofficiële app, niet verbonden met WhatsApp, Discord of Microsoft.

## Ontwikkelen

```bash
npm install     # eenmalig
npm start       # app starten om te testen
npm run dist    # .deb en .AppImage bouwen in dist/
```

## Mappenstructuur

```
src/
  main/              Code van de app zelf (Node.js / Electron)
    index.js         Startpunt: start de app
    window.js        Bouwt het venster op
    store.js         Gedeelde status (wat is er open, actief tabblad, ...)
    config.js        Instellingen opslaan en laden (~/.config/Tabchat/config.json)
    catalog.js       Lijst met diensten + webadressen
    views.js         Tabbladen maken, tonen en verbergen
    actions.js       Alles wat je kunt doen: toevoegen, sluiten, zoomen, ...
    shortcuts.js     Alle sneltoetsen
    palette.js       Snelzoeken (Ctrl+K)
    microsoft.js     Inloggen bij Microsoft (gedeelde login, ingelogd blijven)
    ipc.js           Berichten van de schermen naar de app
  preload/
    preload.js       Brug tussen de schermen en de app
  renderer/          De schermen zelf (HTML)
    tabs.html        Tabbalk bovenin
    home.html        Het +-scherm
    palette.html     Het Ctrl+K-venster
assets/
  icon.png, icon.svg Logo
```

## Iets toevoegen

| Wat                | Waar                                                        |
|--------------------|-------------------------------------------------------------|
| Nieuwe dienst      | Eén regel in `CATALOG` in `src/main/catalog.js`             |
| Nieuwe sneltoets   | `src/main/shortcuts.js` + lijst in `src/renderer/home.html` |
| Nieuwe Ctrl+K-actie| `ACTIONS` in `src/main/palette.js` + `src/renderer/palette.html` |
| Nieuwe instelling  | `DEFAULT_SETTINGS` in `src/main/config.js` + `FEATURES` in `home.html` |

## Licentie

MIT
