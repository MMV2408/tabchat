// When a page stops responding (a tab, or Tabchat's own screens like the tab bar or Ctrl+K):
// a small window with "Wait", "Restart this part" and "Report a problem".
// "Report" opens a pre-filled GitHub issue; nothing is sent automatically.
const { app, dialog, shell } = require('electron');
const path = require('path');
const store = require('./store');
const log = require('./log');
const platform = require('./platform');
const { t } = require('./i18n');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const ISSUES = 'https://github.com/MMV2408/tabchat/issues/new';
let open = null; // AbortController of the window that is showing now

// Which part is this? A tab name, or one of Tabchat's own screens
function partName(wc) {
  for (const [id, v] of Object.entries(store.views)) {
    if (v.webContents === wc) {
      const tab = store.config.tabs.find(x => x.id === id);
      const svc = tab && require('./catalog').CATALOG[tab.service];
      return svc ? svc.name : id;
    }
  }
  const url = wc.getURL();
  return url.startsWith('file:') ? 'Tabchat (' + path.basename(url.split(/[?#]/)[0], '.html') + ')' : (url || '?');
}

function issueUrl(part) {
  const body = [
    '**What were you doing when it stopped responding?**',
    '(for example: pressed Ctrl+K, opened a tab, …)',
    '',
    '**Details** (filled in by Tabchat)',
    `- Not responding: ${part}`,
    `- Tabchat ${app.getVersion()} (${platform.kind}), Electron ${process.versions.electron}`,
    `- ${process.platform} ${process.arch}, ${process.env.XDG_CURRENT_DESKTOP || '?'} / ${process.env.XDG_SESSION_TYPE || '?'}`,
    '',
    'If you can, attach `~/.config/tabchat/tabchat.log`.'
  ].join('\n');
  return `${ISSUES}?title=${encodeURIComponent('Not responding: ' + part)}&body=${encodeURIComponent(body)}`;
}

async function onUnresponsive(wc) {
  if (open || store.quitting || !store.alive()) return;
  const part = partName(wc);
  log.warn('not responding:', part);
  open = new AbortController();
  const signal = open.signal;
  const done = () => wc.removeListener('responsive', close);
  const close = () => { log.info('responding again:', part); if (open) open.abort(); };
  wc.once('responsive', close); // came back by itself: close the window
  try {
    const { response } = await dialog.showMessageBox(store.win, {
      type: 'warning', icon: ICON, signal,
      title: t('hang.title'),
      message: t('hang.message', { part }),
      detail: t('hang.detail'),
      buttons: [t('hang.wait'), t('hang.restart'), t('hang.report')],
      defaultId: 0, cancelId: 0, noLink: true
    });
    if (signal.aborted) return;
    if (response === 1) {
      log.warn('restarting part:', part);
      if (!wc.isDestroyed()) { wc.forcefullyCrashRenderer(); wc.reload(); }
    } else if (response === 2) {
      shell.openExternal(issueUrl(part));
    }
  } catch (e) {
    if (!signal.aborted) log.warn('hang dialog:', e);
  } finally {
    done();
    open = null;
  }
}

function start() {
  app.on('web-contents-created', (_e, wc) => {
    wc.on('unresponsive', () => onUnresponsive(wc));
  });
}

module.exports = { start, issueUrl };
