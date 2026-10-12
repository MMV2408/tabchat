// Runs in every service tab (WhatsApp, Discord, ...).
// 1. Unread: services sometimes report their count via the "app badge"
// (navigator.setAppBadge). We catch it and send it to Tabchat.
// 2. Do not disturb: block the service's notifications while it's on.
// 3. Notification click: open Tabchat on this tab.
// 4. Notifications go through Ubuntu itself when possible, see main/notifier.js.
const { ipcRenderer, webFrame } = require('electron');

// Mouse at the top edge: show the hidden tab bar (only if that setting is on; the app decides)
let lastEdge = 0;
window.addEventListener('mousemove', (e) => {
  if (e.clientY > 24 || Date.now() - lastEdge < 400) return;
  lastEdge = Date.now();
  ipcRenderer.send('bar-edge');
}, { passive: true, capture: true });

const dndAtStart = ipcRenderer.sendSync('get-dnd') === true;
const nativeNotify = ipcRenderer.sendSync('notify-available') === true;

// This code runs in the page itself
webFrame.executeJavaScript(`(() => {
  // ---------- unread (app badge) ----------
  const send = (n) => window.postMessage({ __tabchatBadge: n }, '*');
  navigator.setAppBadge = (n) => { send(n === undefined ? 'dot' : Number(n)); return Promise.resolve(); };
  navigator.clearAppBadge = () => { send(0); return Promise.resolve(); };

  // ---------- do not disturb ----------
  window.__tabchatDnd = ${dndAtStart};

  const N = window.Notification;
  if (N) {
    const Wrapped = function (title, options) {
      if (window.__tabchatDnd) {
        const fake = new EventTarget(); // fake notification that never shows up
        fake.close = () => {};
        return fake;
      }
      if (${nativeNotify}) return new TabchatNotification(title, options);
      const n = new N(title, options);
      n.addEventListener('click', () => window.postMessage({ __tabchatClick: true }, '*'));
      return n;
    };

    // Notification shown by Tabchat via Ubuntu; to the page it behaves like a normal Notification
    const live = new Map();
    let seq = 0;
    class TabchatNotification extends EventTarget {
      constructor(title, options = {}) {
        super();
        this.title = String(title);
        this.body = options.body || '';
        this.tag = options.tag || '';
        this.icon = options.icon || '';
        this.data = options.data === undefined ? null : options.data;
        this.silent = !!options.silent;
        this.onclick = this.onclose = this.onshow = this.onerror = null;
        this._id = ++seq;
        live.set(this._id, this);
        this._send();
      }
      async _send() {
        let image = '';
        try { // send the picture (e.g. profile photo) as a data URL; only the page can read blob: addresses
          if (this.icon) {
            const res = await Promise.race([fetch(new URL(this.icon, location.href)), new Promise((_, r) => setTimeout(r, 800))]);
            const blob = await res.blob();
            if (blob.size < 2000000) image = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(''); fr.readAsDataURL(blob); });
          }
        } catch {
          image = ''; // picture not readable (in time): send the notification without it
        }
        window.postMessage({ __tabchatNotify: { id: this._id, title: this.title, body: this.body, image } }, '*');
        this._fire('show');
      }
      _fire(type) {
        const ev = new Event(type, { cancelable: true });
        try { if (typeof this['on' + type] === 'function') this['on' + type].call(this, ev); } catch (e) { console.error(e); }
        this.dispatchEvent(ev);
        if (type === 'click' || type === 'close') live.delete(this._id);
      }
      close() { window.postMessage({ __tabchatNotifyClose: this._id }, '*'); live.delete(this._id); }
    }
    window.__tabchatNotifyEvent = (id, type) => { const n = live.get(id); if (n) n._fire(type); };
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

// Forward badge count and notification clicks to Tabchat
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return;
  if (e.data.__tabchatClick === true) return ipcRenderer.send('notification-click');
  if (e.data.__tabchatNotify) return ipcRenderer.send('web-notify', e.data.__tabchatNotify);
  if (e.data.__tabchatNotifyClose) return ipcRenderer.send('web-notify-close', e.data.__tabchatNotifyClose);
  if (!('__tabchatBadge' in e.data)) return;
  const n = e.data.__tabchatBadge;
  if (n === 'dot' || (Number.isFinite(n) && n >= 0)) ipcRenderer.send('badge', n);
});

// Pass a click or close of an Ubuntu notification on to the page (e.g. WhatsApp then opens the chat)
ipcRenderer.on('notify-event', (_e, { id, type }) => {
  webFrame.executeJavaScript(`window.__tabchatNotifyEvent && window.__tabchatNotifyEvent(${Number(id)}, ${JSON.stringify(type)})`);
});

// Do not disturb on/off from Tabchat
ipcRenderer.on('dnd', (_e, on) => {
  webFrame.executeJavaScript(`window.__tabchatDnd = ${on ? 'true' : 'false'}`);
});
