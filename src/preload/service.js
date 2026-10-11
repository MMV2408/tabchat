// Draait in elk tabblad van een dienst (WhatsApp, Discord, ...).
// 1. Ongelezen: diensten geven hun aantal soms door via de "app-badge"
//    (navigator.setAppBadge). Die vangen we op en sturen we naar Tabchat.
// 2. Niet storen: meldingen van de dienst tegenhouden zolang het aanstaat.
// 3. Klik op een melding: Tabchat openen op dit tabblad.
// 4. Meldingen gaan (als het kan) via Ubuntu zelf, zie main/notifier.js.
const { ipcRenderer, webFrame } = require('electron');

const dndAtStart = ipcRenderer.sendSync('get-dnd') === true;
const nativeNotify = ipcRenderer.sendSync('notify-available') === true;

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
      if (${nativeNotify}) return new TabchatNotification(title, options);
      const n = new N(title, options);
      n.addEventListener('click', () => window.postMessage({ __tabchatClick: true }, '*'));
      return n;
    };

    // Melding die Tabchat via Ubuntu toont; gedraagt zich voor de pagina als een gewone Notification
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
        try { // plaatje (bv. profielfoto) als data-URL meesturen; blob:-adressen kan alleen de pagina lezen
          if (this.icon) {
            const res = await Promise.race([fetch(new URL(this.icon, location.href)), new Promise((_, r) => setTimeout(r, 800))]);
            const blob = await res.blob();
            if (blob.size < 2000000) image = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(''); fr.readAsDataURL(blob); });
          }
        } catch {}
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

// Badge-getal en klik op melding doorsturen naar Tabchat
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return;
  if (e.data.__tabchatClick === true) return ipcRenderer.send('notification-click');
  if (e.data.__tabchatNotify) return ipcRenderer.send('web-notify', e.data.__tabchatNotify);
  if (e.data.__tabchatNotifyClose) return ipcRenderer.send('web-notify-close', e.data.__tabchatNotifyClose);
  if (!('__tabchatBadge' in e.data)) return;
  const n = e.data.__tabchatBadge;
  if (n === 'dot' || (Number.isFinite(n) && n >= 0)) ipcRenderer.send('badge', n);
});

// Klik of sluiten van een Ubuntu-melding doorgeven aan de pagina (bv. WhatsApp opent dan de chat)
ipcRenderer.on('notify-event', (_e, { id, type }) => {
  webFrame.executeJavaScript(`window.__tabchatNotifyEvent && window.__tabchatNotifyEvent(${Number(id)}, ${JSON.stringify(type)})`);
});

// Niet storen aan/uit vanuit Tabchat
ipcRenderer.on('dnd', (_e, on) => {
  webFrame.executeJavaScript(`window.__tabchatDnd = ${on ? 'true' : 'false'}`);
});
