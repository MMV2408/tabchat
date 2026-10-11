// Meldingen van Tabchat zelf (updates, tray-uitleg).
// Een klik op de melding opent Tabchat; zonder klik-actie lijkt Ubuntu te "laden" en gebeurt er niets.
const { Notification } = require('electron');
const path = require('path');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const live = new Set(); // vasthouden, anders ruimt Node de melding op en werkt klikken niet

function notify({ title, body, onClick }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON });
  live.add(n);
  const done = () => live.delete(n);
  n.on('click', () => {
    done();
    if (onClick) onClick();
    else require('./tray').showWindow();
  });
  n.on('close', done);
  n.show();
}

module.exports = { notify };
