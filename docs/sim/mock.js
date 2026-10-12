// On the website: this screen talks to the simulation on the page (engine.js) instead of the app.
(function () {
  let sim = null;
  try { sim = window.parent !== window && window.parent.TabchatSim; } catch {}
  if (!sim) { location.replace('../'); return; } // opened on its own: go to the website
  window.tabchat = sim.connect(window);
})();
