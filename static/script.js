'use strict';
// ── DOM references ──
const sourceTextEl = document.getElementById('source-text');
const targetLangEl = document.getElementById('target-lang');
const translateBtn = document.getElementById('translate-btn');
const charNumEl = document.getElementById('char-num');
const charCounterEl = document.getElementById('char-counter-source');
const copyBtn = document.getElementById('copy-btn');
const copyConfirm = document.getElementById('copy-confirm');
const swapBtn = document.getElementById('swap-btn');
const historyBtn = document.getElementById('history-btn');

// ── Detect Language elements ──
const detectBtn = document.getElementById('detect-lang-btn');
const detectedLangName = document.getElementById('detected-lang-name');
const sourceLangEl = document.getElementById('source-lang');

const stateIdle = document.getElementById('state-idle');
const stateLoading = document.getElementById('state-loading');
const stateResult = document.getElementById('state-result');
const stateError = document.getElementById('state-error');

const resultText = document.getElementById('result-text');
const contextHintBody = document.getElementById('context-hint-body');
const contextToggleBtn = document.getElementById('context-toggle-btn');
const contextDetail = document.getElementById('context-detail');
const contextDetailText = document.getElementById('context-detail-text');
const contextExamplesList = document.getElementById('context-examples-list');

const errorCode = document.getElementById('error-code');
const errorMessage = document.getElementById('error-message');
const errorHint = document.getElementById('error-hint');

const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const toggleHistoryBtn = document.getElementById('toggle-history-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyCount = document.getElementById('history-count');
const historyHeaderToggle = document.getElementById('history-header-toggle');

const contextualExamples = document.getElementById('contextual-examples');

const RTL_LANGUAGES = new Set(['Urdu', 'Arabic']);

const ERROR_MESSAGES = {
    MODEL_COLD_START: { headline: 'Model warming up — retry in 20s', hint: 'Hugging Face free-tier models spin down when idle. The server retried 5 times automatically. Please wait ~20 seconds and try again.' },
    RATE_LIMIT: { headline: 'Rate limit hit — wait 60s', hint: 'The Hugging Face free-tier rate limit has been reached. Please wait about one minute before sending another request.' },
    AUTH_ERROR: { headline: 'API key invalid', hint: 'Your HUGGINGFACE_API_KEY in .env is missing or incorrect. Get a free token at huggingface.co/settings/tokens.' },
    PERMISSION_DENIED: { headline: 'API permission denied', hint: 'Your Hugging Face token lacks "Make calls to Inference Providers" permission. Generate a new fine-grained token with that permission enabled.' },
    EMPTY_TEXT: { headline: 'Input is empty', hint: 'Please type some text before hitting Translate.' },
    TEXT_TOO_LONG: { headline: 'Text too long', hint: 'Maximum 1000 characters allowed. Shorten your input.' },
    UNSUPPORTED_LANGUAGE: { headline: 'Language not supported', hint: 'Select a supported language from the dropdown.' },
    PIPELINE_ERROR: { headline: 'Pipeline failure', hint: 'An error occurred in the translation backend. Check the Flask console for details.' },
    INTERNAL_ERROR: { headline: 'Internal server error', hint: 'Something unexpected went wrong. Check the Flask console.' },
    NETWORK_ERROR: { headline: 'Network error', hint: 'Could not reach the GeoSpeak server. Make sure Flask is running.' },
    DETECTION_FAILED: { headline: 'Could not detect language', hint: 'The text was too short or ambiguous to reliably detect. Try a longer sentence.' },
};

const ALL_STATES = [stateIdle, stateLoading, stateResult, stateError];

function showState(activeEl) {
    ALL_STATES.forEach(el => el.classList.remove('active'));
    activeEl.classList.add('active');
}

// ── Character counter & reset detection badge ──
sourceTextEl.addEventListener('input', () => {
    const len = sourceTextEl.value.length;
    charNumEl.textContent = len;
    if (charCounterEl) charCounterEl.classList.toggle('near-limit', len > 900);
    // Reset detection badge when text changes — stale detection shouldn't linger
    if (detectBtn) detectBtn.classList.remove('has-result');
});

translateBtn.addEventListener('click', handleTranslate);
sourceTextEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleTranslate(); }
});

if (swapBtn) {
    swapBtn.addEventListener('click', () => {
        const lastResult = resultText.textContent.trim();
        
        // Trigger rotate animation regardless of text state
        swapBtn.classList.add('rotating');
        setTimeout(() => swapBtn.classList.remove('rotating'), 400);

        if (lastResult && lastResult !== '(empty response)' && lastResult !== 'Translation will appear here…') {
            sourceTextEl.value = lastResult;
            sourceTextEl.dispatchEvent(new Event('input'));
        }
    });
}

copyBtn.addEventListener('click', async () => {
    const text = resultText.textContent.trim();
    if (!text || text === 'Translation will appear here…') return;
    
    // Trigger pop/glow animation on button
    copyBtn.classList.add('copied');
    setTimeout(() => copyBtn.classList.remove('copied'), 400);

    try { 
        await navigator.clipboard.writeText(text); 
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
    
    copyConfirm.style.opacity = '1';
    setTimeout(() => copyConfirm.style.opacity = '0', 1500);
});

if (historyBtn) {
    historyBtn.addEventListener('click', () => {
        if (historyPanel) {
            historyPanel.classList.toggle('collapsed');
            if (toggleHistoryBtn) toggleHistoryBtn.textContent = historyPanel.classList.contains('collapsed') ?
                '[ + Expand ]' : '[ - Collapse ]';
        }
    });
}

if (contextToggleBtn && contextDetail) {
    contextToggleBtn.addEventListener('click', () => {
        const isOpen = contextDetail.classList.toggle('open');
        contextToggleBtn.textContent = isOpen ? '[ - Context Hint ]' : '[ + Context Hint ]';
    });
}

if (toggleHistoryBtn && historyPanel) {
    toggleHistoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        historyPanel.classList.toggle('collapsed');
        toggleHistoryBtn.textContent = historyPanel.classList.contains('collapsed') ? '[ + Expand ]' : '[ - Collapse ]';
    });
}
if (historyHeaderToggle && historyPanel) {
    historyHeaderToggle.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        historyPanel.classList.toggle('collapsed');
        if (toggleHistoryBtn) toggleHistoryBtn.textContent = historyPanel.classList.contains('collapsed') ?
            '[ + Expand ]' : '[ - Collapse ]';
    });
}
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => { historyData = []; renderHistory(); });
}

// ── Detect Language — now calls the real backend detector ──
// Replaces the old client-side keyword-matching heuristic with a genuine
// statistical language detector (langdetect) running server-side.
if (detectBtn) {
    detectBtn.addEventListener('click', async function() {
        const text = sourceTextEl.value.trim();
        if (!text) {
            this.style.borderColor = 'rgba(255,199,0,0.4)';
            setTimeout(() => { this.style.borderColor = ''; }, 600);
            return;
        }

        detectBtn.classList.add('detecting');
        detectBtn.disabled = true;

        try {
            const response = await fetch('/detect-language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            const data = await response.json();

                       if (!response.ok) {
                // Detection failed or language not supported by the UI —
                // flash red AND show the user why, instead of failing silently.
                console.warn('Language detection issue:', data.error || data.code);
                detectBtn.style.borderColor = 'rgba(255,80,80,0.5)';
                setTimeout(() => { detectBtn.style.borderColor = ''; }, 800);

                const msg = data.code === 'DETECTION_FAILED'
                    ? 'Could not detect language — try a longer sentence.'
                    : (data.error || 'Could not detect language.');

                if (detectedLangName) {
                    detectedLangName.textContent = msg;
                    detectBtn.classList.add('has-result');
                    setTimeout(() => {
                        detectBtn.classList.remove('has-result');
                    }, 2500);
                }
                return;
            }

            const langName = data.language;

            // Update source language selector to match the real detection
            if (sourceLangEl) {
                const options = sourceLangEl.options;
                let found = false;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === langName) {
                        sourceLangEl.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    const opt = document.createElement('option');
                    opt.value = langName;
                    opt.textContent = langName;
                    sourceLangEl.appendChild(opt);
                    sourceLangEl.value = langName;
                }
            }

            // Show detected badge
            if (detectedLangName) detectedLangName.textContent = langName;
            detectBtn.classList.add('has-result');

            // flash success feedback
            detectBtn.style.borderColor = 'rgba(0,240,255,0.4)';
            setTimeout(() => { detectBtn.style.borderColor = ''; }, 600);

        } catch (err) {
            console.error('Language detection network error:', err);
            detectBtn.style.borderColor = 'rgba(255,80,80,0.5)';
            setTimeout(() => { detectBtn.style.borderColor = ''; }, 800);
        } finally {
            detectBtn.classList.remove('detecting');
            detectBtn.disabled = false;
        }
    });
}

// ── Translation handler (unchanged) ──
async function handleTranslate() {
    const text = sourceTextEl.value.trim();
    const targetLang = targetLangEl.value;
    if (!text) { showError('EMPTY_TEXT', ''); return; }
    if (text.length > 1000) { showError('TEXT_TOO_LONG', ''); return; }
    if (!targetLang) { showError('UNSUPPORTED_LANGUAGE', 'Please select a target language from the dropdown.'); return; }
    setLoading(true);
    showState(stateLoading);
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, target_lang: targetLang }),
        });
        const data = await response.json();
        if (!response.ok) {
            const code = data.code || 'PIPELINE_ERROR';
            const extra = data.error || '';
            showError(code, extra);
            return;
        }
        const translation = data.translation || '(empty response)';
        resultText.textContent = translation;

        // Match Confidence Badge handling
        const confidenceContainer = document.getElementById('confidence-container');
        const confidenceText = document.getElementById('confidence-text');
        if (confidenceContainer && confidenceText) {
            if (data.confidence !== undefined && data.confidence !== null) {
                const pct = Math.round(data.confidence * 100);
                confidenceText.textContent = `${pct}%`;
                confidenceContainer.style.display = 'flex';
            } else {
                confidenceContainer.style.display = 'none';
            }
        }

        // Context hints handling
        const hasExamples = data.context_examples && data.context_examples.length > 0;

        const contextInsightsPanel = document.getElementById('context-insights-panel');
        const contextVectorTags = document.getElementById('context-vector-tags');
        if (contextInsightsPanel && contextVectorTags) {
            contextInsightsPanel.style.display = 'flex';
            if (hasExamples) {
                contextVectorTags.innerHTML = '<span class="tag">Context Matched</span>';
            } else {
                contextVectorTags.innerHTML =
                    '<span style="font-size:11px; font-weight:400; color:var(--text-muted);">No specific context matched — translation generated from the model\'s general knowledge</span>';
            }
        }

        const contextHintCard = document.getElementById('context-hint-card');
        if (contextHintCard) {
            if (hasExamples) {
                contextHintCard.style.display = 'block';
                const count = data.context_examples.length;
                const msg =
                    `Retrieved ${count} matching contextual example${count > 1 ? 's' : ''} from database to guide translation.`;
                contextHintBody.textContent = msg;
                contextDetailText.textContent = msg;
                if (contextToggleBtn) contextToggleBtn.style.display = 'inline-block';
            } else {
                contextHintCard.style.display = 'none';
            }
        }

        const isRTL = RTL_LANGUAGES.has(targetLang);
        resultText.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        resultText.style.textAlign = isRTL ? 'right' : 'left';
        renderContextExamples(data.context_examples || []);
        copyConfirm.style.opacity = '0';
        showState(stateResult);
        addToHistory(text, targetLang, translation);
        updateContextualExamples(data.context_examples || []);
    } catch (err) {
        console.error('GeoSpeak fetch error:', err);
        showError('NETWORK_ERROR', err.message);
    } finally { setLoading(false); }
}

function showError(code, rawMessage) {
    const map = ERROR_MESSAGES[code] || {};
    const header = map.headline || code.replace(/_/g, ' ');
    const hint = map.hint || rawMessage || '';
    errorCode.textContent = `[ERROR: ${code}]`;
    errorMessage.textContent = header;
    errorHint.textContent = hint;
    setLoading(false);
    showState(stateError);
}

function setLoading(isLoading) {
    translateBtn.disabled = isLoading;
    translateBtn.classList.toggle('loading-anim', isLoading);
    translateBtn.innerHTML = isLoading ? 
        '<span class="icon">⟳</span> Translating…' : 
        '<span class="icon">✦</span> Translate';
}

function renderContextExamples(examples) {
    if (!contextExamplesList) return;
    contextExamplesList.innerHTML = '';
    if (!examples || examples.length === 0) {
        contextExamplesList.innerHTML =
            '<div class="cx-empty">No matching examples found — translation generated from the model\'s general knowledge.</div>';
        return;
    }
    examples.forEach(ex => {
        const div = document.createElement('div');
        div.className = 'cx-item';
        div.innerHTML = `
              <span class="cx-label">Retrieved example</span>
              <div><strong>Source:</strong> ${escapeHTML(ex.source_text)}</div>
              <div><strong>Target:</strong> ${escapeHTML(ex.target_text)}</div>
            `;
        contextExamplesList.appendChild(div);
    });
}

function updateContextualExamples(examples) {
    if (!contextualExamples) return;
    if (!examples || examples.length === 0) {
        contextualExamples.style.display = 'flex';
        contextualExamples.innerHTML =
            '<span style="font-size:11px; font-weight:400; color:var(--text-muted);">No specific context matched &mdash; translation generated from the model\'s general knowledge</span>';
        return;
    }
    contextualExamples.style.display = 'grid';
    contextualExamples.innerHTML = '<span class="ex-label">Examples</span>';

    examples.slice(0, 2).forEach((ex, i) => {
        const cxNum = i + 1;
        const c1 = document.createElement('div');
        c1.className = `example-card context-${cxNum}`;
        c1.innerHTML = `
            <div class="card-header">Matched Context</div>
            <div class="card-body">${escapeHTML(ex.source_text)}</div>
        `;
        contextualExamples.appendChild(c1);

        const c2 = document.createElement('div');
        c2.className = 'example-card translation-card';
        c2.innerHTML = `
            <div class="card-header">Translation Example</div>
            <div class="card-body">${escapeHTML(ex.target_text)}</div>
        `;
        contextualExamples.appendChild(c2);
    });
}

let historyData = [];

function addToHistory(source, targetLang, result) {
    if (!historyList) return;
    historyData.unshift({ source, targetLang, result });
    if (historyData.length > 10) historyData.pop();
    renderHistory();
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    if (historyData.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No translations yet.</div>';
        if (historyCount) historyCount.textContent = '(0)';
        return;
    }
    if (historyCount) historyCount.textContent = `(${historyData.length})`;
    
    historyData.forEach((item, index) => {
        const isRTL = RTL_LANGUAGES.has(item.targetLang);
        const dir = isRTL ? 'rtl' : 'ltr';
        const align = isRTL ? 'right' : 'left';
        const div = document.createElement('div');
        div.className = 'history-item';
        
        // Add staggered inline delay animation
        div.style.animation = `popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s backward`;
        
        div.innerHTML = `
            <div class="h-item-header"><span class="h-item-lang">${escapeHTML(item.targetLang)}</span></div>
            <div class="h-item-source">${escapeHTML(item.source)}</div>
            <div class="h-item-target" dir="${dir}" style="text-align:${align};">${escapeHTML(item.result)}</div>
        `;
        historyList.appendChild(div);
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' } [tag] || tag));
}

renderHistory();
console.log('GeoSpeak AI — real backend language detection active.');