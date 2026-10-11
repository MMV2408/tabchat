// Klein hulpprogramma dat de meldingen naar Ubuntu stuurt (draait als apart proces, zonder venster).
//
// Waarom apart? Ubuntu (GNOME) koppelt een melding aan de app van het proces dat hem stuurt.
// Komt hij van Tabchat zelf, dan "start" GNOME Tabchat bij een klik (zeker als het venster
// geminimaliseerd is) en laat de muis ~15 seconden laden. Een proces zonder venster hoort bij
// geen enkele app, dus GNOME start niets: geen laden. De klik geven we door aan Tabchat.
const dbus = require('dbus-next');

const NAME = 'org.freedesktop.Notifications';
const OBJ = '/org/freedesktop/Notifications';
const send = (m) => { try { process.send(m); } catch {} };

let bus;
try {
  bus = dbus.sessionBus();
  bus.on('error', () => process.exit(1));
} catch { process.exit(1); }

bus.call(new dbus.Message({
  destination: 'org.freedesktop.DBus', path: '/org/freedesktop/DBus', interface: 'org.freedesktop.DBus',
  member: 'AddMatch', signature: 's', body: [`type='signal',interface='${NAME}'`]
})).catch(() => {});

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
    })).catch(() => {});
  }
});

process.on('disconnect', () => process.exit(0)); // Tabchat is afgesloten
send({ type: 'ready' });
