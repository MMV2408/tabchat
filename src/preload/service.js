// Draait in elk tabblad van een dienst (WhatsApp, Discord, ...).
// Diensten geven hun aantal ongelezen berichten soms door via de "app-badge"
// (navigator.setAppBadge) in plaats van in de paginatitel. Die vangen we hier op
// en sturen we naar Tabchat, zodat we weten bij welk tabblad het hoort.
const { ipcRenderer, webFrame } = require('electron');

// In de pagina zelf de badge-functies vervangen door een versie die het getal doorgeeft
webFrame.executeJavaScript(`(() => {
  const send = (n) => window.postMessage({ __tabchatBadge: n }, '*');
  navigator.setAppBadge = (n) => { send(n === undefined ? 'dot' : Number(n)); return Promise.resolve(); };
  navigator.clearAppBadge = () => { send(0); return Promise.resolve(); };
})()`);

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || !('__tabchatBadge' in e.data)) return;
  const n = e.data.__tabchatBadge;
  if (n === 'dot' || (Number.isFinite(n) && n >= 0)) ipcRenderer.send('badge', n);
});
