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

// Output state panels
const stateIdle     = document.getElementById('state-idle');
const stateLoading  = document.getElementById('state-loading');
const stateResult   = document.getElementById('state-result');
const stateError    = document.getElementById('state-error');

// Result panel elements
const resultText    = document.getElementById('result-text');
const resultBadge   = document.getElementById('result-lang-badge');

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

// ── Translate ──────────────────────────────────────────────────
translateBtn.addEventListener('click', handleTranslate);

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

    // Apply RTL/LTR direction based on target language
    const isRTL = RTL_LANGUAGES.has(targetLang);
    resultText.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    resultText.style.textAlign = isRTL ? 'right' : 'left';

    copyConfirm.classList.remove('show');
    showState(stateResult);

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
