/**
 * GeoSpeak — script.js
 * Handles the /translate fetch call, all UI state transitions,
 * character counter, and copy-to-clipboard.
 */

'use strict';

// ── DOM references ─────────────────────────────────────────────
const sourceTextEl  = document.getElementById('source-text');
const targetLangEl  = document.getElementById('target-lang');
const translateBtn  = document.getElementById('translate-btn');
const charNumEl     = document.getElementById('char-num');
const charCountEl   = document.getElementById('char-count');
const copyBtn       = document.getElementById('copy-btn');
const copyConfirm   = document.getElementById('copy-confirm');
const swapBtn       = document.getElementById('swap-btn');

// Output state panels
const stateIdle     = document.getElementById('state-idle');
const stateLoading  = document.getElementById('state-loading');
const stateResult   = document.getElementById('state-result');
const stateError    = document.getElementById('state-error');

// Result panel elements
const resultText    = document.getElementById('result-text');
const resultBadge   = document.getElementById('result-lang-badge');
const confidenceBadge = document.getElementById('result-confidence-badge');
const contextPanel  = document.getElementById('context-panel');
const contextToggle = document.getElementById('context-toggle');
const contextList   = document.getElementById('context-list');

// Error panel elements
const errorCode     = document.getElementById('error-code');
const errorMessage  = document.getElementById('error-message');
const errorHint     = document.getElementById('error-hint');

// ── RTL language set ─────────────────────────────────────────
const RTL_LANGUAGES = new Set(['Urdu', 'Arabic']);

// ── Error code → user-friendly messages ───────────────────────
const ERROR_MESSAGES = {
  MODEL_COLD_START: {
    headline: 'MODEL WARMING UP — RETRY IN 20s',
    hint:     'Hugging Face free-tier models spin down when idle. '
            + 'The server retried 5 times automatically. '
            + 'Please wait ~20 seconds and try again.',
  },
  RATE_LIMIT: {
    headline: 'RATE LIMIT HIT — WAIT 60s',
    hint:     'The Hugging Face free-tier rate limit has been reached. '
            + 'Please wait about one minute before sending another request.',
  },
  AUTH_ERROR: {
    headline: 'API KEY INVALID',
    hint:     'Your HUGGINGFACE_API_KEY in .env is missing or incorrect. '
            + 'Get a free token at huggingface.co/settings/tokens.',
  },
  PERMISSION_DENIED: {
    headline: 'API PERMISSION DENIED',
    hint:     'Your Hugging Face token lacks "Make calls to Inference '
            + 'Providers" permission. Generate a new fine-grained token '
            + 'with that permission enabled.',
  },
  EMPTY_TEXT: {
    headline: 'INPUT IS EMPTY',
    hint:     'Please type some text before hitting TRANSLATE NOW.',
  },
  TEXT_TOO_LONG: {
    headline: 'TEXT TOO LONG',
    hint:     'Maximum 1000 characters allowed. Shorten your input.',
  },
  UNSUPPORTED_LANGUAGE: {
    headline: 'LANGUAGE NOT SUPPORTED',
    hint:     'Select a supported language from the dropdown.',
  },
  PIPELINE_ERROR: {
    headline: 'PIPELINE FAILURE',
    hint:     'An error occurred in the translation backend. Check the Flask console for details.',
  },
  INTERNAL_ERROR: {
    headline: 'INTERNAL SERVER ERROR',
    hint:     'Something unexpected went wrong. Check the Flask console.',
  },
  NETWORK_ERROR: {
    headline: 'NETWORK ERROR',
    hint:     'Could not reach the GeoSpeak server. Make sure Flask is running.',
  },
};

// ── State machine ──────────────────────────────────────────────
const ALL_STATES = [stateIdle, stateLoading, stateResult, stateError];

function showState(activeEl) {
  ALL_STATES.forEach(el => el.classList.remove('active'));
  activeEl.classList.add('active');
}

// ── Character counter ──────────────────────────────────────────
sourceTextEl.addEventListener('input', () => {
  const len = sourceTextEl.value.length;
  charNumEl.textContent = len;
  charCountEl.classList.toggle('near-limit', len > 900);
});

// ── Translate & Swap ───────────────────────────────────────────
translateBtn.addEventListener('click', handleTranslate);

if (swapBtn) {
  swapBtn.addEventListener('click', () => {
    const lastResult = resultText.textContent.trim();
    if (lastResult && lastResult !== '(empty response)') {
      sourceTextEl.value = lastResult;
      // trigger char counter update
      sourceTextEl.dispatchEvent(new Event('input'));
    }
  });
}

// Also allow Ctrl+Enter from the textarea
sourceTextEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleTranslate();
  }
});

async function handleTranslate() {
  const text       = sourceTextEl.value.trim();
  const targetLang = targetLangEl.value;

  // ── Client-side quick validation ───────────────────────────
  if (!text) {
    showError('EMPTY_TEXT', '');
    return;
  }
  if (text.length > 1000) {
    showError('TEXT_TOO_LONG', '');
    return;
  }
  if (!targetLang) {
    showError('UNSUPPORTED_LANGUAGE', 'Please select a target language from the dropdown.');
    return;
  }

  // ── Show loading ────────────────────────────────────────────
  setLoading(true);
  showState(stateLoading);

  try {
    const response = await fetch('/translate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, target_lang: targetLang }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Server returned a structured error
      const code  = data.code  || 'PIPELINE_ERROR';
      const extra = data.error || '';
      showError(code, extra);
      return;
    }

    // ── Success ─────────────────────────────────────────────
    resultBadge.textContent = targetLang.toUpperCase();
    resultText.textContent  = data.translation || '(empty response)';

    if (data.confidence !== undefined && data.confidence !== null) {
      confidenceBadge.textContent = `MATCH CONFIDENCE: ${Math.round(data.confidence * 100)}%`;
      confidenceBadge.classList.add('show');
    } else {
      confidenceBadge.classList.remove('show');
    }

    // Apply RTL/LTR direction based on target language
    const isRTL = RTL_LANGUAGES.has(targetLang);
    resultText.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    resultText.style.textAlign = isRTL ? 'right' : 'left';

    copyConfirm.classList.remove('show');
    showState(stateResult);
    addToHistory(text, targetLang, data.translation || '(empty response)');
    renderContextExamples(data.context_examples || []);

  } catch (err) {
    // Network / JSON parse failure
    console.error('GeoSpeak fetch error:', err);
    showError('NETWORK_ERROR', err.message);
  } finally {
    setLoading(false);
  }
}

// ── Error helper ───────────────────────────────────────────────
function showError(code, rawMessage) {
  const map    = ERROR_MESSAGES[code] || {};
  const header = map.headline || code.replace(/_/g, ' ');
  const hint   = map.hint     || rawMessage || '';

  errorCode.textContent    = `[ERROR: ${code}]`;
  errorMessage.textContent = header;
  errorHint.textContent    = hint;

  setLoading(false);
  showState(stateError);
}

// ── Loading guard (disable button while in-flight) ─────────────
function setLoading(isLoading) {
  translateBtn.disabled    = isLoading;
  translateBtn.textContent = isLoading ? 'TRANSLATING…' : 'TRANSLATE NOW';
}

// ── Context / Why Panel ────────────────────────────────────────
if (contextToggle && contextPanel) {
  contextToggle.addEventListener('click', () => {
    const isCollapsed = contextPanel.classList.toggle('collapsed');
    contextToggle.textContent = isCollapsed
      ? '[ + WHY THIS TRANSLATION? ]'
      : '[ - WHY THIS TRANSLATION? ]';
  });
}

function renderContextExamples(examples) {
  if (!contextList || !contextPanel) return;
  contextList.innerHTML = '';
  // Reset to collapsed state
  contextPanel.classList.add('collapsed');
  if (contextToggle) contextToggle.textContent = '[ + WHY THIS TRANSLATION? ]';

  if (!examples || examples.length === 0) {
    contextList.innerHTML =
      '<div class="context-empty">No matching examples found \u2014 translation generated from the model\'s general knowledge.</div>';
    return;
  }

  examples.forEach(ex => {
    const div = document.createElement('div');
    div.className = 'context-item';
    div.innerHTML = `
      <div class="context-item-label">RETRIEVED EXAMPLE</div>
      <div class="context-item-source">Source: ${escapeHTML(ex.source_text)}</div>
      <div>Target: ${escapeHTML(ex.target_text)}</div>
    `;
    contextList.appendChild(div);
  });
}

// ── Copy to clipboard ──────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  const text = resultText.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers / non-HTTPS
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  copyConfirm.classList.add('show');
  setTimeout(() => copyConfirm.classList.remove('show'), 1500);
});

// ── History Logic ──────────────────────────────────────────────
let historyData = [];

const toggleHistoryBtn = document.getElementById('toggle-history-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');

if (toggleHistoryBtn && clearHistoryBtn && historyPanel && historyList) {
  toggleHistoryBtn.addEventListener('click', () => {
    const isCollapsed = historyPanel.classList.toggle('collapsed');
    toggleHistoryBtn.textContent = isCollapsed ? '[+] EXPAND' : '[-] COLLAPSE';
  });

  clearHistoryBtn.addEventListener('click', () => {
    historyData = [];
    renderHistory();
  });

  renderHistory(); // Initial render
}

function addToHistory(source, targetLang, result) {
  if (!historyList) return;
  historyData.unshift({ source, targetLang, result });
  if (historyData.length > 10) {
    historyData.pop();
  }
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = '';
  if (historyData.length === 0) {
    historyList.innerHTML = '<div style="font-size:0.8rem; color:var(--grey-mid); font-weight:700;">NO HISTORY YET.</div>';
    return;
  }
  
  historyData.forEach(item => {
    const isRTL = RTL_LANGUAGES.has(item.targetLang);
    const dir = isRTL ? 'rtl' : 'ltr';
    const align = isRTL ? 'right' : 'left';
    
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-item-header">
        <span class="history-lang">${escapeHTML(item.targetLang)}</span>
      </div>
      <div class="history-source">${escapeHTML(item.source)}</div>
      <div class="history-target" dir="${dir}" style="text-align: ${align};">${escapeHTML(item.result)}</div>
    `;
    historyList.appendChild(div);
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ── Theme Toggle ───────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  // Check local storage for existing preference
  const isDarkMode = localStorage.getItem('geospeak-theme') === 'dark';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const mode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('geospeak-theme', mode);
  });
}
