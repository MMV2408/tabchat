// Zet de app-simulatie op de website (docs/sim) klaar met de echte schermen van Tabchat.
// Draai na wijzigingen aan home.html, tabs.html, teksten of diensten:  node scripts/build-site.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const out = path.join(root, 'docs', 'sim');
fs.mkdirSync(out, { recursive: true });

// Een stuk JavaScript (object of lijst) uit een bronbestand halen, zonder de app te starten
function literal(file, name) {
  const s = src(file);
  const start = s.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`${name} niet gevonden in ${file}`);
  let i = s.indexOf('=', start) + 1, depth = 0, inStr = null, began = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); continue; }
    if (c === '{' || c === '[') { depth++; began = true; }
    if (c === '}' || c === ']') { depth--; if (began && depth === 0) break; }
  }
  const text = s.slice(s.indexOf('=', start) + 1, i + 1);
  return new Function('return ' + text)();
}

const catalog = literal('src/main/catalog.js', 'CATALOG');
const data = {
  version: JSON.parse(src('package.json')).version,
  strings: literal('src/main/i18n.js', 'STRINGS'),
  settings: literal('src/main/config.js', 'DEFAULT_SETTINGS'),
  catalog: Object.fromEntries(Object.entries(catalog).map(([id, c]) => [id, { name: c.name, key: c.key, color: c.color, awake: !!c.awake }])),
  keys: literal('src/renderer/home.html', 'KEYS'),
  changelog: literal('src/main/changelog.js', 'CHANGELOG')
};
fs.writeFileSync(path.join(out, 'data.js'), '// Gemaakt door scripts/build-site.js, niet met de hand aanpassen\nwindow.SIM_DATA = ' + JSON.stringify(data) + ';\n');

// De schermen zelf, met een nep-"tabchat" (mock.js) in plaats van de echte app
for (const f of ['home.html', 'tabs.html']) {
  const html = src('src/renderer/' + f).replace('</head>', '<script src="mock.js"></script>\n</head>');
  fs.writeFileSync(path.join(out, f), html);
}

// Thema: naast "volg het systeem" ook vast licht/donker, gekozen door de website
const theme = src('src/renderer/theme.css');
const m = theme.match(/@media \(prefers-color-scheme: light\) \{\s*:root \{([\s\S]*?)\}\s*\}/);
if (!m) throw new Error('licht thema niet gevonden in theme.css');
fs.writeFileSync(path.join(out, 'theme.css'),
  theme.slice(0, m.index) + `:root[data-theme="light"] {${m[1]}}\n`);

console.log('Klaar: docs/sim (versie ' + data.version + ')');
