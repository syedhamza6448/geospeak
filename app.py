"""
GeoSpeak — app.py
Phase 2: Full RAG pipeline using free-tier stack.

Architecture:
  1. sentence-transformers/all-MiniLM-L6-v2  — local embeddings, zero cost
  2. FAISS (in-memory)                        — vector similarity search index
     (fulfills the SRS "Vector Database" role without a standalone DB service)
  3. Hugging Face Inference API (free tier)   — hosted LLM for translation


Model choice:
  - meta-llama/Llama-3.2-3B-Instruct
      PRO : Lightweight instruct model ideal for free-tier endpoints. Fast inference
            with minimal latency; handles instruction-following translation tasks
            exceptionally well when guided by few-shot RAG examples.
      CON : Smaller capacity than 7B/8B models; relies heavily on clean RAG context
            to maintain target language vocabulary and style accuracy.
"""

import os
import time
import logging
import threading
import requests
import numpy as np
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import sys

# Real language detection (offline, free, no API calls needed)
from langdetect import detect as langdetect_detect, DetectorFactory, LangDetectException
DetectorFactory.seed = 0  # deterministic results across runs

# Ensure proper utf-8 encoding for terminal output on Windows
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# ---------------------------------------------------------------------------
# Environment & logging
# ---------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

# Hugging Face Settings
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
# The ":featherless-ai" suffix pins the provider explicitly, since Hugging Face's
# router doesn't reliably auto-select a working provider for every model.
HF_MODEL = "meta-llama/Llama-3.2-3B-Instruct:featherless-ai"
HF_HEADERS = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}

# Retry settings for HF cold-start (503 "Model is currently loading")
MAX_RETRIES = 5
BACKOFF_BASE = 10  # seconds — doubles each retry: 10, 20, 40 …

# Keep-alive settings (for Render / free hosting tier 5-minute self-ping)
KEEP_ALIVE_INTERVAL = int(os.getenv("KEEP_ALIVE_INTERVAL", "300"))  # 300 seconds = 5 minutes
KEEP_ALIVE_ENABLED = os.getenv("KEEP_ALIVE_ENABLED", "true").lower() in ("true", "1", "yes")
_keep_alive_started = False

# Supported target languages (plain-name keys shown in UI)
# NOTE: keep this in sync with the <option> values in templates/index.html
SUPPORTED_LANGUAGES = {
    "French", "Spanish", "German", "Urdu", "Japanese",
    "Italian", "Portuguese", "Dutch", "Russian", "Chinese",
    "Korean", "Arabic", "Hindi", "Turkish",
}

# Map UI language names → corpus 2-letter ISO codes
LANGUAGE_CODE_MAP = {
    "French": "fr", "Spanish": "es", "German": "de",
    "Urdu": "ur", "Japanese": "ja",
    "Italian": "it", "Portuguese": "pt", "Dutch": "nl",
    "Russian": "ru", "Chinese": "zh", "Korean": "ko",
    "Arabic": "ar", "Hindi": "hi", "Turkish": "tr",
}

# Map langdetect's ISO 639-1 codes → display names used in the UI dropdowns.
# langdetect returns "zh-cn"/"zh-tw" for Chinese variants, hence the special case.
DETECT_CODE_TO_NAME = {
    "en": "English", "fr": "French", "es": "Spanish", "de": "German",
    "ur": "Urdu", "ja": "Japanese", "it": "Italian", "pt": "Portuguese",
    "nl": "Dutch", "ru": "Russian", "zh-cn": "Chinese", "zh-tw": "Chinese",
    "ko": "Korean", "ar": "Arabic", "hi": "Hindi", "tr": "Turkish",
}

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Background Keep-Alive Self-Ping (Render Free Tier Keep-Alive)
# ---------------------------------------------------------------------------
def _keep_alive_worker():
    """
    Background daemon thread that periodically pings the /health endpoint
    every 5 minutes (300 seconds) to keep free hosting tiers (e.g. Render) awake.
    """
    # Short initial delay to let server initialize
    time.sleep(10)
    log.info("Keep-alive worker active. Pinging every %ds.", KEEP_ALIVE_INTERVAL)

    while True:
        # Render automatically sets RENDER_EXTERNAL_URL in production (e.g. https://geospeak.onrender.com)
        target_url = os.getenv("PING_URL") or os.getenv("RENDER_EXTERNAL_URL")
        if not target_url:
            port = os.getenv("PORT", "5000")
            target_url = f"http://127.0.0.1:{port}"

        target_endpoint = target_url.rstrip("/") + "/health"
        try:
            res = requests.get(target_endpoint, timeout=10)
            log.info("Keep-alive ping sent to %s -> Status: %d", target_endpoint, res.status_code)
        except Exception as exc:
            log.warning("Keep-alive ping to %s failed: %s", target_endpoint, exc)

        time.sleep(KEEP_ALIVE_INTERVAL)


def start_keep_alive():
    """Start the keep-alive background worker thread if not already running."""
    global _keep_alive_started
    if _keep_alive_started or not KEEP_ALIVE_ENABLED or app.config.get("TESTING"):
        return
    _keep_alive_started = True
    thread = threading.Thread(target=_keep_alive_worker, daemon=True, name="KeepAliveWorker")
    thread.start()


# ---------------------------------------------------------------------------
# Corpus loading
# ---------------------------------------------------------------------------
CORPUS_PATH = os.path.join(os.path.dirname(__file__), "data", "corpus.txt")


def load_corpus(path: str) -> list[dict]:
    """
    Parse pipe-delimited corpus file.
    Lines starting with '#' or blank lines are ignored.
    Expected format per line: source_lang|target_lang|source_text|target_text
    Returns a list of dicts with keys: source_lang, target_lang, source_text, target_text
    """
    entries = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|")
                if len(parts) != 4:
                    log.warning("Skipping malformed corpus line: %s", line)
                    continue
                entries.append({
                    "source_lang": parts[0].strip(),
                    "target_lang": parts[1].strip(),
                    "source_text": parts[2].strip(),
                    "target_text": parts[3].strip(),
                })
    except FileNotFoundError:
        log.error("Corpus file not found at %s — FAISS index will be empty.", path)
    log.info("Loaded %d corpus entries from %s", len(entries), path)
    return entries


# ---------------------------------------------------------------------------
# Embedding model + FAISS index — built once at startup
# ---------------------------------------------------------------------------
corpus_entries: list[dict] = []
faiss_index = None
embedding_model = None


def build_index():
    """Load sentence-transformer model and build FAISS index at startup."""
    global corpus_entries, faiss_index, embedding_model

    # --- Lazy-import heavy deps so missing packages give a clear error ---
    try:
        from fastembed import TextEmbedding
        import faiss as faiss_lib
    except ImportError as exc:
        log.error("Missing dependency: %s. Run: pip install -r requirements.txt", exc)
        return

    log.info("Loading fastembed model (all-MiniLM-L6-v2, ONNX runtime)…")
    try:
        embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
    except Exception as exc:
        log.error("Failed to load embedding model: %s", exc)
        return

    corpus_entries = load_corpus(CORPUS_PATH)
    if not corpus_entries:
        log.warning("Corpus is empty — FAISS index not built.")
        return

    source_texts = [e["source_text"] for e in corpus_entries]
    log.info("Computing embeddings for %d corpus entries…", len(source_texts))
    try:
        embeddings = np.array(list(embedding_model.embed(source_texts)), dtype="float32")
        # L2-normalize for cosine similarity via inner product
        faiss_lib.normalize_L2(embeddings)
    except Exception as exc:
        log.error("Embedding computation failed: %s", exc)
        return

    dim = embeddings.shape[1]
    faiss_index = faiss_lib.IndexFlatIP(dim)  # Inner-product ≡ cosine on L2-normed vecs
    faiss_index.add(embeddings)
    log.info("FAISS index built: %d vectors, dim=%d", faiss_index.ntotal, dim)


# ---------------------------------------------------------------------------
# RAG retrieval
# ---------------------------------------------------------------------------
def retrieve_examples(text: str, target_lang: str, k: int = 3) -> tuple[list[dict], float | None]:
    """
    Embed input text and retrieve top-k similar corpus entries
    filtered by the requested target language.
    Falls back to unfiltered top-k if no lang-filtered results exist.
    """
    if faiss_index is None or embedding_model is None:
        return [], None

    try:
        import faiss as faiss_lib
        query_vec = np.array(list(embedding_model.embed([text])), dtype="float32")
        faiss_lib.normalize_L2(query_vec)

        # Search more candidates so we can filter by language
        search_k = min(k * 6, faiss_index.ntotal)
        distances, indices = faiss_index.search(query_vec, search_k)

        # Filter to target language, keeping insertion order
        filtered_with_scores = [
            (corpus_entries[i], distances[0][idx])
            for idx, i in enumerate(indices[0])
            if i < len(corpus_entries)
            and corpus_entries[i]["target_lang"].lower() == LANGUAGE_CODE_MAP.get(target_lang, "").lower()
        ]

        if not filtered_with_scores:
            # No lang-specific examples — fall back to top-k regardless of lang
            filtered_with_scores = [
                (corpus_entries[i], distances[0][idx])
                for idx, i in enumerate(indices[0])
                if i < len(corpus_entries)
            ]

        top_k = filtered_with_scores[:k]
        examples = [item[0] for item in top_k]
        top_score = float(top_k[0][1]) if top_k else None

        return examples, top_score
    except Exception as exc:
        log.warning("FAISS retrieval failed: %s", exc)
        return [], None


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------
def build_prompt(text: str, target_lang: str, examples: list[dict]) -> str:
    """
    Construct a few-shot instruction prompt for the hosted LLM.
    Explicitly instructs the model to prefer idiomatic equivalents over
    literal word-for-word translations when the source contains figurative
    language — this satisfies the SRS's idiom/context-awareness requirement.
    """
    example_block = ""
    if examples:
        example_lines = "\n".join(
            f'  Source: "{e["source_text"]}"\n  Translation ({target_lang}): "{e["target_text"]}"'
            for e in examples
        )
        example_block = (
            "Here are some translation examples to guide your style:\n"
            f"{example_lines}\n\n"
        )

    prompt = (
        f"You are an expert translator. If the source text matches or closely "
        f"resembles one of the examples below, you MUST use that example's exact "
        f"target-language phrasing as your answer, not a literal word-for-word "
        f"translation.\n\n{example_block}"
        f"Translate the following text to {target_lang}: '{text}'\n"
        "Respond with ONLY the translated text, no explanations or extra commentary."
    )
    return prompt


# ---------------------------------------------------------------------------
# Hugging Face Inference API call with retry-on-cold-start
# ---------------------------------------------------------------------------
def call_hf_api(prompt: str) -> str:
    """
    Send prompt to HF Inference API. Retries up to MAX_RETRIES times on
    503 (model loading / cold-start) with exponential back-off.
    Raises RuntimeError on unrecoverable failure.
    """
    if not HUGGINGFACE_API_KEY or HUGGINGFACE_API_KEY == "hf_your_token_here":
        raise RuntimeError("HUGGINGFACE_API_KEY not set. Add it to your .env file.")

    payload = {
        "model": HF_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 200,
        "temperature": 0.3
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(HF_API_URL, headers=HF_HEADERS, json=payload, timeout=60)
        except requests.exceptions.Timeout:
            raise RuntimeError("Request to Hugging Face API timed out (60 s).")
        except requests.exceptions.ConnectionError as exc:
            raise RuntimeError(f"Network error reaching Hugging Face API: {exc}")

        # ── Diagnostic logging on every response ──────────────────
        log.info("HF API response — status: %d", response.status_code)
        if response.status_code != 200:
            log.error(
                "HF API error details:\n"
                "  Status : %d\n"
                "  Headers: %s\n"
                "  Body   : %s",
                response.status_code,
                dict(response.headers),
                response.text[:1000],
            )

        if response.status_code == 200:
            data = response.json()
            # Response should follow OpenAI spec: {"choices": [{"message": {"content": "..."}}]}
            if "choices" in data and len(data["choices"]) > 0:
                translation = data["choices"][0].get("message", {}).get("content", "").strip()
                if translation:
                    return translation
            log.error("Unexpected HF API 200 response format: %s", data)
            raise RuntimeError(f"Unexpected HF API response format: {data}")

        if response.status_code == 503:
            # Model is loading (cold-start) — back off and retry
            wait = BACKOFF_BASE * (2 ** (attempt - 1))
            log.warning(
                "HF model cold-starting (503). Attempt %d/%d — retrying in %ds…",
                attempt, MAX_RETRIES, wait,
            )
            if attempt == MAX_RETRIES:
                raise RuntimeError(
                    "MODEL_COLD_START: Hugging Face model is still loading after "
                    f"{MAX_RETRIES} retries. Please retry in ~30 seconds."
                )
            time.sleep(wait)
            continue

        if response.status_code == 429:
            raise RuntimeError(
                "RATE_LIMIT: Hugging Face free-tier rate limit reached. "
                "Please wait a minute before retrying."
            )

        if response.status_code == 401:
            raise RuntimeError(
                "AUTH_ERROR: Invalid HUGGINGFACE_API_KEY. "
                "Check your .env file and token at huggingface.co/settings/tokens."
            )

        if response.status_code == 403:
            raise RuntimeError(
                "PERMISSION_DENIED: 403 Forbidden. This authentication method does not have sufficient permissions to call Inference Providers."
            )

        # Any other HTTP error
        raise RuntimeError(
            f"HF API returned HTTP {response.status_code}: {response.text[:500]}"
        )

    # Should never reach here due to raises inside loop, but just in case
    raise RuntimeError("Failed to get a response from Hugging Face API.")




# ---------------------------------------------------------------------------
# Main translation function
# ---------------------------------------------------------------------------
def get_translation(text: str, target_lang: str) -> tuple[str, float | None, list[dict]]:
    """
    Full RAG pipeline:
      1. Retrieve similar corpus examples via FAISS
      2. Build few-shot instruction prompt
      3. Call HF Inference API
      4. Clean and return translation + confidence + examples
    """
    examples, confidence = retrieve_examples(text, target_lang)
    log.info("Retrieved %d examples for target_lang='%s'", len(examples), target_lang)

    prompt = build_prompt(text, target_lang, examples)
    log.info("Sending prompt to HF API (model=%s)…", HF_MODEL)

    raw_output = call_hf_api(prompt)

    # Strip any residual instruction echoes or common model preambles
    cleaned = raw_output.strip().strip('"').strip("'")
    # Remove common preamble patterns the model sometimes adds
    for prefix in (
        f"Translation ({target_lang}):",
        "Translation:",
        f"{target_lang} translation:",
        "Sure!",
        "Here is the translation:",
        "[/INST]",
    ):
        if cleaned.lower().startswith(prefix.lower()):
            cleaned = cleaned[len(prefix):].strip()

    return cleaned, confidence, examples


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Render the main GeoSpeak UI."""
    return render_template("index.html")


# Simple in-memory rate limiter: { ip_address: [timestamp1, timestamp2, ...] }
rate_limit_records = {}


@app.route("/translate", methods=["POST"])
def translate():
    """
    POST /translate
    Request JSON : {"text": "...", "target_lang": "French"}
    Response JSON: {"translation": "..."} or {"error": "...", "code": "..."}
    """
    # --- Rate limiting ---
    client_ip = request.remote_addr or "unknown"
    now = time.time()

    # Get active timestamps for this IP within the last 60 seconds
    timestamps = rate_limit_records.get(client_ip, [])
    active_timestamps = [t for t in timestamps if now - t <= 60]

    # Prune empty IP lists from memory to prevent long-term growth
    to_delete = []
    for ip, ts_list in rate_limit_records.items():
        pruned = [t for t in ts_list if now - t <= 60]
        if not pruned:
            to_delete.append(ip)
        else:
            rate_limit_records[ip] = pruned
    for ip in to_delete:
        rate_limit_records.pop(ip, None)

    if len(active_timestamps) >= 10:
        return jsonify({
            "error": "Rate limit exceeded. Please wait before retrying.",
            "code": "RATE_LIMIT"
        }), 429

    active_timestamps.append(now)
    rate_limit_records[client_ip] = active_timestamps

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON.", "code": "BAD_REQUEST"}), 400

    text = data.get("text", "").strip()
    target_lang = data.get("target_lang", "").strip()

    # --- Input validation ---
    if not text:
        return jsonify({"error": "Field 'text' is required and cannot be empty.", "code": "EMPTY_TEXT"}), 400
    if len(text) > 1000:
        return jsonify({"error": "Input text exceeds 1000-character limit.", "code": "TEXT_TOO_LONG"}), 400
    if target_lang not in SUPPORTED_LANGUAGES:
        return jsonify({
            "error": f"Unsupported target language '{target_lang}'. "
                     f"Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}.",
            "code": "UNSUPPORTED_LANGUAGE",
        }), 400

    # --- Run pipeline ---
    try:
        translation, confidence, examples = get_translation(text, target_lang)
        resp = {"translation": translation}
        if confidence is not None:
            resp["confidence"] = round(confidence, 2)
        resp["context_examples"] = [
            {"source_text": ex["source_text"], "target_text": ex["target_text"]}
            for ex in examples
        ]
        return jsonify(resp)

    except Exception as exc:
        log.exception("Unexpected error in /translate")
        return jsonify({"error": f"Internal server error: {exc}", "code": "INTERNAL_ERROR"}), 500


@app.route("/detect-language", methods=["POST"])
def detect_language():
    """
    POST /detect-language
    Request JSON : {"text": "..."}
    Response JSON: {"language": "French", "code": "fr"}
                or {"error": "...", "code": "..."}

    Uses langdetect (offline, statistical n-gram detection) — a real
    detector, not a keyword heuristic. Free, no API calls, no cost.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON.", "code": "BAD_REQUEST"}), 400

    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "Field 'text' is required and cannot be empty.", "code": "EMPTY_TEXT"}), 400

    try:
        detected_code = langdetect_detect(text)
    except LangDetectException:
        return jsonify({
            "error": "Could not reliably detect the language of the given text.",
            "code": "DETECTION_FAILED",
        }), 422

    language_name = DETECT_CODE_TO_NAME.get(detected_code)
    if not language_name:
        # Detected a real language, just not one GeoSpeak has UI support for
        return jsonify({
            "error": f"Detected language code '{detected_code}' is not supported by GeoSpeak's UI.",
            "code": "UNSUPPORTED_LANGUAGE",
            "detected_code": detected_code,
        }), 422

    log.info("Detected language: %s (code=%s) for input text.", language_name, detected_code)
    return jsonify({"language": language_name, "code": detected_code})


@app.route("/health", methods=["GET"])
def health():
    """GET /health - basic liveness check"""
    return jsonify({"status": "ok"}), 200


# ---------------------------------------------------------------------------
# Build the model + FAISS index once, at import time. This runs whether the
# app is started via `python app.py` (local dev) OR via gunicorn
# (`gunicorn app:app` on Render) — since gunicorn never executes the
# `if __name__ == "__main__":` block below, building the index there only
# worked locally and left every request on Render trying (and failing) to
# build it lazily on first request.
# ---------------------------------------------------------------------------
start_keep_alive()
build_index()


# ---------------------------------------------------------------------------
# Entry point (local dev only — gunicorn on Render skips this entirely)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)