// Alle sneltoetsen op één plek.
// Nieuwe sneltoets = één regel hier (en in de lijst in home.html).
const store = require('./store');
const { serviceByKey } = require('./catalog');
const actions = require('./actions');
const palette = require('./palette');
const views = require('./views');

// source: 'tab', 'bar', 'home' of 'palette' (waar de toets werd ingedrukt)
function handler(source) {
  return (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
    const ctrl = input.control || input.meta;
    const { alt, shift } = input;
    const run = (fn) => { event.preventDefault(); fn(); };

    // Werkt overal, ook in het snelzoekvenster
    if (ctrl && !alt && !shift && key === 'k') return run(palette.toggle);
    if (ctrl && !alt && !shift && key === 'q') return run(actions.quit);
    if (source === 'palette') return; // de rest regelt het snelzoekvenster zelf

    if (alt && !ctrl && !shift) {
      // Alt+1 t/m Alt+8: naar dat tabblad, Alt+9: laatste tabblad
      if (/^[1-9]$/.test(key)) return run(() => actions.goToIndex(key === '9' ? -1 : Number(key) - 1));
      // In het +-scherm: Alt+beginletter voegt een nieuw tabblad van die dienst toe
      if (store.active === 'home') {
        const service = serviceByKey(key);
        if (service) return run(() => actions.addTab(service));
      }
      if (key === 't') return run(() => views.show('home'));
      if (key === 'm') return run(() => actions.toggleMute());
      if (key === 'ArrowLeft') return run(() => actions.navigate(-1));
      if (key === 'ArrowRight') return run(() => actions.navigate(1));
    }

    if (ctrl && !alt) {
      if (key === 'Tab') return run(() => actions.cycle(shift ? -1 : 1));
      if (!shift && key === 'w') return run(() => actions.closeTab());
      if (shift && key === 't') return run(actions.reopenTab);
      if (shift && key === 'PageUp') return run(() => actions.moveTab(store.active, -1));
      if (shift && key === 'PageDown') return run(() => actions.moveTab(store.active, 1));
      if (key === '+' || (!shift && key === '=')) return run(() => actions.zoom(0.1));
      if (!shift && key === '-') return run(() => actions.zoom(-0.1));
      if (!shift && key === '0') return run(() => actions.zoom(0));
    }

    if (!ctrl && !alt && !shift) {
      if (key === 'F5') return run(() => actions.reload());
      if (key === 'F11') return run(actions.toggleFullScreen);
    }
  };
}

Object.assign(module.exports, { handler });
