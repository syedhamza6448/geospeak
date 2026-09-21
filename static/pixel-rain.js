/**
 * GeoSpeak — Legacy compatibility alias
 * Redirects to the Terminal Chic Aesthetic Background Engine.
 */
(function() {
  // If terminal-canvas.js is not loaded yet, execute inline
  if (!window._terminalCanvasLoaded) {
    window._terminalCanvasLoaded = true;
    var script = document.createElement('script');
    script.src = '/static/terminal-canvas.js';
    script.async = true;
    document.head.appendChild(script);
  }
})();
