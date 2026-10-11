// Op de website: dit scherm praat met de simulatie op de pagina (engine.js) in plaats van met de app.
(function () {
  let sim = null;
  try { sim = window.parent !== window && window.parent.TabchatSim; } catch {}
  if (!sim) { location.replace('../'); return; } // los geopend: naar de website
  window.tabchat = sim.connect(window);
})();
