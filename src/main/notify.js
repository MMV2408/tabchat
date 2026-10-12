// Notifications from Tabchat itself (updates, tray explanation).
// Clicking opens Tabchat; without a click action Ubuntu seems to "load" and nothing happens.
const { Notification } = require('electron');
const path = require('path');

const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const live = new Set(); // keep a reference, otherwise Node garbage-collects the notification and clicks stop working

function notify({ title, body, onClick }) {
  const notifier = require('./notifier');
  if (notifier.isAvailable()) { // via Ubuntu: no loading cursor after a click (falls back to Electron by itself)
    return notifier.show({ title, body, onClick: onClick || (() => require('./tray').showWindow()) });
  }
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
