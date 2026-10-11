// Draait in elk tabblad van een dienst (WhatsApp, Discord, ...).
// 1. Ongelezen: diensten geven hun aantal soms door via de "app-badge"
//    (navigator.setAppBadge). Die vangen we op en sturen we naar Tabchat.
// 2. Niet storen: meldingen van de dienst tegenhouden zolang het aanstaat.
// 3. Klik op een melding: Tabchat openen op dit tabblad.
const { ipcRenderer, webFrame } = require('electron');

const dndAtStart = ipcRenderer.sendSync('get-dnd') === true;

// Deze code draait in de pagina zelf
webFrame.executeJavaScript(`(() => {
  // ---------- ongelezen (app-badge) ----------
  const send = (n) => window.postMessage({ __tabchatBadge: n }, '*');
  navigator.setAppBadge = (n) => { send(n === undefined ? 'dot' : Number(n)); return Promise.resolve(); };
  navigator.clearAppBadge = () => { send(0); return Promise.resolve(); };

  // ---------- niet storen ----------
  window.__tabchatDnd = ${dndAtStart};

  const N = window.Notification;
  if (N) {
    const Wrapped = function (title, options) {
      if (window.__tabchatDnd) {
        const fake = new EventTarget(); // nep-melding die nergens verschijnt
        fake.close = () => {};
        return fake;
      }
      const n = new N(title, options);
      n.addEventListener('click', () => window.postMessage({ __tabchatClick: true }, '*'));
      return n;
    };
    Wrapped.prototype = N.prototype;
    Object.defineProperty(Wrapped, 'permission', { get: () => N.permission });
    Object.defineProperty(Wrapped, 'maxActions', { get: () => N.maxActions });
    Wrapped.requestPermission = (...a) => N.requestPermission(...a);
    window.Notification = Wrapped;
  }

  if (window.ServiceWorkerRegistration) {
    const show = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (...a) {
      return window.__tabchatDnd ? Promise.resolve() : show.apply(this, a);
    };
  }
})()`);

// Badge-getal en klik op melding doorsturen naar Tabchat
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return;
  if (e.data.__tabchatClick === true) return ipcRenderer.send('notification-click');
  if (!('__tabchatBadge' in e.data)) return;
  const n = e.data.__tabchatBadge;
  if (n === 'dot' || (Number.isFinite(n) && n >= 0)) ipcRenderer.send('badge', n);
});

// Niet storen aan/uit vanuit Tabchat
ipcRenderer.on('dnd', (_e, on) => {
  webFrame.executeJavaScript(`window.__tabchatDnd = ${on ? 'true' : 'false'}`);
});
