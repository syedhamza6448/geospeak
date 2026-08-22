"""
GeoSpeak — app.py
Phase 2: Full RAG pipeline using free-tier stack.

Architecture:
  1. sentence-transformers/all-MiniLM-L6-v2  — local embeddings, zero cost
  2. FAISS (in-memory)                        — vector similarity search
  3. Hugging Face Inference API (free tier)   — hosted LLM for translation

Model choice trade-off (used in get_translation):
  - mistralai/Mistral-7B-Instruct-v0.2
      PRO : General instruction-following; handles any language pair and nuanced
            prompts well; produces natural, conversational translations.
      CON : Larger model → longer cold-start on free tier (~20-40 s); may pad
            output with extra commentary that needs stripping.

  - facebook/nllb-200-distilled-600M
      PRO : Purpose-built multilingual translation model; faster inference;
            more predictable output format (raw translation, no commentary).
      CON : Requires BCP-47 language codes (e.g. "fra_Latn") instead of plain
            language names; less flexible for custom prompts.

  Decision: We default to Mistral-7B-Instruct because our RAG prompt is
  instruction-formatted. Switch HF_MODEL below to nllb if you prefer speed.
"""

import os
import time
import logging
import requests
import numpy as np
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Environment & logging
# ---------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

# Hugging Face Inference API endpoint — swap to nllb model string if desired
HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"
HF_API_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL}"
HF_HEADERS = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}

# Retry settings for HF cold-start (503 "Model is currently loading")
MAX_RETRIES = 5
BACKOFF_BASE = 10  # seconds — doubles each retry: 10, 20, 40 …

# Supported target languages (plain-name keys shown in UI)
SUPPORTED_LANGUAGES = {"French", "Spanish", "German", "Urdu", "Japanese"}

app = Flask(__name__)


# Build the index when the first request arrives — this guarantees it runs
# even when Flask's reloader spawns a child process (avoids double-loading).
@app.before_request
def ensure_index_built():
    global faiss_index, embedding_model
    if faiss_index is None and embedding_model is None:
        build_index()


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
        from sentence_transformers import SentenceTransformer
        import faiss as faiss_lib
    except ImportError as exc:
        log.error("Missing dependency: %s. Run: pip install -r requirements.txt", exc)
        return

    log.info("Loading sentence-transformers model (all-MiniLM-L6-v2)…")
    try:
        embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
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
        embeddings = embedding_model.encode(source_texts, convert_to_numpy=True, show_progress_bar=False)
        embeddings = embeddings.astype("float32")
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
def retrieve_examples(text: str, target_lang: str, k: int = 3) -> list[dict]:
    """
    Embed input text and retrieve top-k similar corpus entries
    filtered by the requested target language.
    Falls back to unfiltered top-k if no lang-filtered results exist.
    """
    if faiss_index is None or embedding_model is None:
        return []

    try:
        import faiss as faiss_lib
        query_vec = embedding_model.encode([text], convert_to_numpy=True).astype("float32")
        faiss_lib.normalize_L2(query_vec)

        # Search more candidates so we can filter by language
        search_k = min(k * 6, faiss_index.ntotal)
        distances, indices = faiss_index.search(query_vec, search_k)

        # Filter to target language, keeping insertion order
        filtered = [
            corpus_entries[i]
            for i in indices[0]
            if i < len(corpus_entries)
            and corpus_entries[i]["target_lang"].lower() == target_lang[:2].lower()
        ]

        if not filtered:
            # No lang-specific examples — fall back to top-k regardless of lang
            filtered = [corpus_entries[i] for i in indices[0] if i < len(corpus_entries)]

        return filtered[:k]
    except Exception as exc:
        log.warning("FAISS retrieval failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------
def build_prompt(text: str, target_lang: str, examples: list[dict]) -> str:
    """
    Construct a few-shot instruction prompt for Mistral-7B-Instruct.
    The [INST] / [/INST] tags are the Mistral instruction format.
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
        f"[INST] You are an expert translator. {example_block}"
        f'Translate the following text to {target_lang}: \'{text}\'\n'
        "Respond with ONLY the translated text, no explanations or extra commentary. [/INST]"
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
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 200,
            "temperature": 0.3,
            "do_sample": True,
            "return_full_text": False,  # Only return newly generated tokens
        },
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(HF_API_URL, headers=HF_HEADERS, json=payload, timeout=60)
        except requests.exceptions.Timeout:
            raise RuntimeError("Request to Hugging Face API timed out (60 s).")
        except requests.exceptions.ConnectionError as exc:
            raise RuntimeError(f"Network error reaching Hugging Face API: {exc}")

        if response.status_code == 200:
            data = response.json()
            # Response is a list: [{"generated_text": "..."}]
            if isinstance(data, list) and data:
                return data[0].get("generated_text", "").strip()
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

        # Any other HTTP error
        raise RuntimeError(
            f"HF API returned HTTP {response.status_code}: {response.text[:300]}"
        )

    raise RuntimeError("Exhausted all retries calling Hugging Face API.")


# ---------------------------------------------------------------------------
# Main translation function
# ---------------------------------------------------------------------------
def get_translation(text: str, target_lang: str) -> str:
    """
    Full RAG pipeline:
      1. Retrieve similar corpus examples via FAISS
      2. Build few-shot instruction prompt
      3. Call HF Inference API
      4. Clean and return translation
    """
    examples = retrieve_examples(text, target_lang)
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

    return cleaned


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Render the main GeoSpeak UI."""
    return render_template("index.html")


@app.route("/translate", methods=["POST"])
def translate():
    """
    POST /translate
    Request JSON : {"text": "...", "target_lang": "French"}
    Response JSON: {"translation": "..."} or {"error": "...", "code": "..."}
    """
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
        translation = get_translation(text, target_lang)
        return jsonify({"translation": translation})

    except RuntimeError as exc:
        msg = str(exc)
        # Distinguish known error types for meaningful frontend messages
        if msg.startswith("MODEL_COLD_START"):
            return jsonify({"error": msg, "code": "MODEL_COLD_START"}), 503
        if msg.startswith("RATE_LIMIT"):
            return jsonify({"error": msg, "code": "RATE_LIMIT"}), 429
        if msg.startswith("AUTH_ERROR"):
            return jsonify({"error": msg, "code": "AUTH_ERROR"}), 401
        return jsonify({"error": msg, "code": "PIPELINE_ERROR"}), 500

    except Exception as exc:
        log.exception("Unexpected error in /translate")
        return jsonify({"error": f"Internal server error: {exc}", "code": "INTERNAL_ERROR"}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    build_index()
    app.run(debug=True)
