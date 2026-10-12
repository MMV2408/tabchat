// Prepares the app simulation on the website (docs/sim) with Tabchat's real screens.
// Run after changes to home.html, tabs.html, texts or services:  node scripts/build-site.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const out = path.join(root, 'docs', 'sim');
fs.mkdirSync(out, { recursive: true });

// Pull a piece of JavaScript (object or array) out of a source file, without starting the app
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
  catalog: Object.fromEntries(Object.entries(catalog).map(([id, c]) => [id, { name: c.name, key: c.key || null, color: c.color, awake: !!c.awake, base: c.base || null, group: c.group || null, askUrl: !!c.askUrl }])),
  keys: literal('src/renderer/home.html', 'KEYS'),
  changelog: literal('src/main/changelog.js', 'CHANGELOG')
};
fs.writeFileSync(path.join(out, 'data.js'), '// Gemaakt door scripts/build-site.js, niet met de hand aanpassen\nwindow.SIM_DATA = ' + JSON.stringify(data) + ';\n');

// The screens themselves, with a fake "tabchat" (mock.js) instead of the real app
for (const f of ['home.html', 'tabs.html']) {
  const html = src('src/renderer/' + f).replace('</head>', '<script src="mock.js"></script>\n</head>');
  fs.writeFileSync(path.join(out, f), html);
}

// Theme: besides "follow the system" also fixed light/dark, chosen by the website
const theme = src('src/renderer/theme.css');
const m = theme.match(/@media \(prefers-color-scheme: light\) \{\s*:root \{([\s\S]*?)\}\s*\}/);
if (!m) throw new Error('licht thema niet gevonden in theme.css');
fs.writeFileSync(path.join(out, 'theme.css'),
  theme.slice(0, m.index) + `:root[data-theme="light"] {${m[1]}}\n`);

// Version after the sim files in index.html, so browsers don't use an old cached copy after a release
const idx = path.join(__dirname, '..', 'docs', 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(/(src="sim\/[\w.-]+\.(?:js|html))(\?v=[\w.-]+)?"/g, `$1?v=${data.version}"`));
console.log('Klaar: docs/sim (versie ' + data.version + ')');
