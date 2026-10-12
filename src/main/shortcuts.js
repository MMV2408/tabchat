// All keyboard shortcuts in one place.
// New shortcut = one line here (and in the list in home.html).
const store = require('./store');
const { serviceByKey } = require('./catalog');
const actions = require('./actions');
const palette = require('./palette');
const views = require('./views');

// source: 'tab', 'bar', 'home' or 'palette' (where the key was pressed)
function handler(source) {
  return (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
    const ctrl = input.control || input.meta;
    const { alt, shift } = input;
    const run = (fn) => { event.preventDefault(); fn(); };

    // Alt (on its own) shows the hidden tab bar
    if (key === 'Alt' && !ctrl && !shift && store.config.settings.tabBar === 'autohide') {
      views.revealBar(!store.barRevealed);
      return;
    }
    // Works everywhere, also in the quick search window
    if (ctrl && !alt && !shift && key === 'k') return run(palette.toggle);
    if (ctrl && !alt && !shift && key === 'q') return run(actions.quit);
    if (source === 'palette') return; // the quick search window handles the rest itself

    if (alt && !ctrl && !shift) {
      // Alt+1 to Alt+8: go to that tab, Alt+9: last tab
      if (/^[1-9]$/.test(key)) return run(() => actions.goToIndex(key === '9' ? -1 : Number(key) - 1));
      // On the + screen: Alt+first letter adds a new tab of that service
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
      if (!shift && key === '\\') return run(() => require('./split').toggle());
      if (!shift && key === 'f' && source === 'tab') return run(() => require('./find').open());
      if (shift && key === 't') return run(actions.reopenTab);
      if (shift && key === 'PageUp') return run(() => actions.moveTab(store.active, -1));
      if (shift && key === 'PageDown') return run(() => actions.moveTab(store.active, 1));
      if (key === '+' || (!shift && key === '=')) return run(() => actions.zoom(0.1));
      if (!shift && key === '-') return run(() => actions.zoom(-0.1));
      if (!shift && key === '0') return run(() => actions.zoom(0));
    }

    if (!ctrl && !alt && !shift) {
      if (key === 'Escape' && store.findOpen) return run(() => require('./find').close());
      if (key === 'F5') return run(() => actions.reload());
      if (key === 'F11') return run(actions.toggleFullScreen);
    }
  };
}

Object.assign(module.exports, { handler });
