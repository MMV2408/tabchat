// Downloads from a service (a PDF from Brightspace, a photo from WhatsApp, ...):
// saved straight to your Downloads folder, with a notification to open the folder.
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');
const log = require('./log');

const watched = new WeakSet(); // sessions that already have the handler

// "report.pdf" exists? Then "report (1).pdf", "report (2).pdf", ...
function freePath(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext) || 'download';
  let file = path.join(dir, base + ext);
  for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${base} (${n})${ext}`);
  return file;
}

function watch(ses) {
  if (watched.has(ses)) return;
  watched.add(ses);
  ses.on('will-download', (_e, item) => {
    const file = freePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(file); // no save dialog
    item.once('done', (_ev, state) => {
      const notify = require('./notify').notify;
      if (state === 'completed') {
        notify({ title: t('dl.done', { name: path.basename(file) }), body: t('dl.body'), onClick: () => shell.showItemInFolder(file) });
      } else if (state !== 'cancelled') {
        log.warn('download failed:', item.getURL(), state);
        notify({ title: t('dl.failed', { name: path.basename(file) }), body: t('dl.failedBody') });
      }
    });
  });
}

module.exports = { watch };
