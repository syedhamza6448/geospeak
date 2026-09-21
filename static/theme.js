/**
 * GeoSpeak — Universal Apple Glass Theme Controller
 * Supports: 'light' and 'dark' (Obsidian Cybernetic)
 * Features:
 * - Immediate anti-FOUC initialization
 * - LocalStorage persistence ('geospeak-theme')
 * - Automatic OS system preference detection (prefers-color-scheme)
 * - Smooth CSS transitions without layout shift
 * - Custom event dispatch ('geospeak-theme-change') for Canvas rendering
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'geospeak-theme';

  function getSystemPreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return null;
  }

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') || getSavedTheme() || getSystemPreference();
  }

  function syncUI(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const label = btn.querySelector('.theme-label');
      if (label) {
        label.textContent = theme === 'dark' ? 'Dark' : 'Light';
      }
      btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      btn.setAttribute('title', `Current: ${theme.toUpperCase()} mode (Click to toggle)`);
    });
  }

  function setTheme(theme, animate = false) {
    if (animate) {
      document.documentElement.classList.add('theme-transitioning');
    }

    document.documentElement.setAttribute('data-theme', theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}

    syncUI(theme);

    // Notify listeners (e.g. terminal-canvas.js)
    window.dispatchEvent(new CustomEvent('geospeak-theme-change', { detail: { theme } }));

    if (animate) {
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 360);
    }
  }

  function toggleTheme() {
    const current = getActiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
  }

  // Initial application immediately
  const initial = getSavedTheme() || getSystemPreference();
  document.documentElement.setAttribute('data-theme', initial);

  // Bind DOM elements on load
  function initThemeButtons() {
    syncUI(getActiveTheme());

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      // Remove any existing click listener clones
      btn.removeEventListener('click', toggleTheme);
      btn.addEventListener('click', toggleTheme);
    });

    // Listen to OS theme changes if user hasn't set an explicit preference
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!getSavedTheme()) {
          setTheme(e.matches ? 'dark' : 'light', true);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeButtons);
  } else {
    initThemeButtons();
  }

  // Public global API
  window.GeoSpeakTheme = {
    get: getActiveTheme,
    set: (t) => setTheme(t, true),
    toggle: toggleTheme,
  };
})();
