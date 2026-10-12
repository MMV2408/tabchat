// Small helper that sends notifications to Ubuntu (runs as a separate process, without a window).
//
// Why separate? Ubuntu (GNOME) links a notification to the app of the process that sends it.
// If it comes from Tabchat itself, GNOME "starts" Tabchat on a click (especially when the window
// is minimized) and shows a loading cursor for ~15 seconds. A process without a window belongs to
// no app, so GNOME starts nothing: no loading. We pass the click on to Tabchat.
const dbus = require('dbus-next');

const NAME = 'org.freedesktop.Notifications';
const OBJ = '/org/freedesktop/Notifications';
// Parent gone (Tabchat quit)? Then there's nobody to tell, so a failed send is fine
const send = (m) => { try { process.send(m); } catch { /* parent gone */ } };
const report = (where) => (e) => send({ type: 'log', text: where + ': ' + (e && e.message) });

let bus;
try {
  bus = dbus.sessionBus();
  bus.on('error', () => process.exit(1));
} catch { process.exit(1); }

bus.call(new dbus.Message({
  destination: 'org.freedesktop.DBus', path: '/org/freedesktop/DBus', interface: 'org.freedesktop.DBus',
  member: 'AddMatch', signature: 's', body: [`type='signal',interface='${NAME}'`]
})).catch(report('dbus call 1'));

bus.on('message', (msg) => {
  if (msg.type !== dbus.MessageType.SIGNAL || msg.interface !== NAME) return;
  const [id, arg] = msg.body || [];
  if (msg.member === 'ActionInvoked') send({ type: 'click', id });
  else if (msg.member === 'NotificationClosed') send({ type: 'closed', id, reason: arg });
});

process.on('message', (m) => {
  if (m.type === 'show') {
    const hints = {};
    if (m.image) hints['image-path'] = new dbus.Variant('s', m.image);
    bus.call(new dbus.Message({
      destination: NAME, path: OBJ, interface: NAME, member: 'Notify', signature: 'susssasa{sv}i',
      body: ['Tabchat', 0, m.icon, m.title, m.body, ['default', 'Open'], hints, -1]
    })).then((r) => send({ type: 'shown', key: m.key, id: r && r.body && r.body[0] }))
      .catch(() => send({ type: 'shown', key: m.key, id: null }));
  } else if (m.type === 'close') {
    bus.call(new dbus.Message({
      destination: NAME, path: OBJ, interface: NAME, member: 'CloseNotification', signature: 'u', body: [m.id]
    })).catch(report('dbus call 2'));
  }
});

process.on('disconnect', () => process.exit(0)); // Tabchat has quit
send({ type: 'ready' });
