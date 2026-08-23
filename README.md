# GeoSpeak — AI-powered real-time language translation web app (free-tier GenAI stack)

---

## Table of Contents

- [About](#about)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup \& Installation](#setup--installation)
- [Current Status](#current-status)
- [Roadmap](#roadmap)
- [License / Author](#license--author)

---

## About

GeoSpeak is a translation web app that uses a Retrieval-Augmented Generation (RAG) pipeline built on a **100 % free tech stack** — no OpenAI, no paid APIs. On startup, it loads a parallel-translation corpus, computes embeddings with a local `sentence-transformers` model, and indexes them with FAISS. When a user submits text, the app retrieves the most similar corpus examples, injects them into a few-shot instruction prompt, and sends that prompt to the Hugging Face Inference API (free tier) for translation. The result is streamed back to a brutalist-styled frontend.

Supported target languages in the UI: **French, Spanish, German, Urdu, Japanese**.

> **Known limitation:** The bundled corpus (`data/corpus.txt`) contains example pairs for French, Spanish, German, and Urdu only — Japanese has no corpus entries, so RAG retrieval for Japanese will fall back to unfiltered top-k examples. The Hugging Face free tier can also have cold-start delays (20–40 s on first request) and rate limits.

---

## Tech Stack

| Component | Technology | How it's used |
|---|---|---|
| Backend framework | [Flask](https://flask.palletsprojects.com/) | Routes, JSON API, template rendering |
| Local embeddings | [sentence-transformers](https://www.sbert.net/) (`all-MiniLM-L6-v2`) | Encodes corpus & user input into vectors — runs locally, zero cost |
| Vector search | [FAISS](https://github.com/facebookresearch/faiss) (`faiss-cpu`) | In-memory cosine-similarity search over corpus embeddings |
| LLM translation | [Hugging Face Inference API](https://huggingface.co/inference-api) (free tier) | Calls `meta-llama/Llama-3.2-3B-Instruct:featherless-ai` (pinned to the Featherless AI provider) |
| Numerical computing | [NumPy](https://numpy.org/) | Embedding array operations |
| HTTP client | [Requests](https://docs.python-requests.org/) | Calls the Hugging Face API |
| HF utilities | [huggingface_hub](https://huggingface.co/docs/huggingface_hub/) | Hugging Face ecosystem support |
| Environment config | [python-dotenv](https://pypi.org/project/python-dotenv/) | Loads `HUGGINGFACE_API_KEY` from `.env` |
| Frontend | HTML5 / CSS / JavaScript | Brutalist UI with Space Mono font (Google Fonts) |

---

## Project Structure

```
geospeak/
├── app.py                  # Flask app — RAG pipeline, routes, HF API integration
├── requirements.txt        # Python dependencies
├── .env.example            # Template: HUGGINGFACE_API_KEY=hf_your_token_here
├── .gitignore              # Ignores .env, __pycache__, venv, model cache, etc.
├── PHASES.md               # Internal build-plan document (5-phase roadmap)
├── data/
│   └── corpus.txt          # Parallel corpus (48 entries: en→fr/es/de/ur)
├── static/
│   ├── style.css           # Brutalist design system (506 lines)
│   └── script.js           # Client-side logic: fetch, state machine, copy-to-clipboard
└── templates/
    └── index.html          # Main UI: input panel, output states, responsive layout
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Python** | 3.9 or higher |
| **pip** | Comes bundled with Python 3.9+ |
| **Hugging Face account** | Free — sign up at [huggingface.co](https://huggingface.co/join) |

> **Note:** On first run, `sentence-transformers` will download the `all-MiniLM-L6-v2` model (~80 MB) to a local cache. This requires an internet connection and may take a minute.

---

## Setup & Installation

Follow these steps to get GeoSpeak running on your local machine.

### 1. Clone the repository

```bash
git clone <repo-url>
cd geospeak
```

### 2. Create and activate a virtual environment

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (PowerShell):**

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**

```cmd
python -m venv venv
venv\Scripts\activate.bat
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows
```

### 5. Get a free Hugging Face API token

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
2. Click **New token** → give it a name (e.g. `geospeak`) → select the **Read** role → click **Generate**.
3. Copy the token and paste it into your `.env` file:

```env
HUGGINGFACE_API_KEY=hf_your_actual_token_here
```

### 6. Run the application

```bash
python app.py
```

This runs Flask's development server with `debug=True`. You can also use:

```bash
flask run
```

### 7. Open in browser

Navigate to:

```
http://127.0.0.1:5000
```

> **First request will be slow.** The sentence-transformer model loads on the first incoming request, and the Hugging Face model may need 20–40 s to cold-start. Subsequent requests are faster.

---

## Current Status

### What's implemented and working

- ✅ **RAG translation pipeline** — corpus loading → local embeddings → FAISS index → few-shot prompt → HF Inference API call → cleaned translation response.
- ✅ **`GET /`** — renders the brutalist-styled `index.html` UI.
- ✅ **`POST /translate`** — accepts `{"text": "...", "target_lang": "..."}`, runs the full pipeline, returns `{"translation": "..."}`.
- ✅ **Input validation** — rejects empty text, text over 1000 characters, and unsupported target languages with structured JSON error responses and appropriate HTTP status codes.
- ✅ **HF cold-start retry** — automatic exponential back-off (up to 5 retries) on 503 responses from the Hugging Face API.
- ✅ **Error handling** — distinct error codes for cold-start (`MODEL_COLD_START`), rate limit (`RATE_LIMIT`), auth failure (`AUTH_ERROR`), pipeline errors, and internal errors.
- ✅ **Brutalist frontend** — Space Mono font, acid-yellow (#F5FF00) accent, harsh drop shadows, no border-radius, blocky pulsing loading animation, responsive layout.
- ✅ **Client-side UX** — character counter (with near-limit warning), Ctrl+Enter shortcut, copy-to-clipboard with confirmation, user-friendly error messages mapped from backend error codes.
- ✅ **Parallel corpus** — 48 entries across English → French, Spanish, German, and Urdu.
- ✅ **Model details** — uses `meta-llama/Llama-3.2-3B-Instruct:featherless-ai` pinned to the Featherless AI provider via Hugging Face's API.

### What's missing or incomplete

- ❌ **Japanese corpus data** — Japanese is listed in the UI dropdown and `SUPPORTED_LANGUAGES`, but `corpus.txt` has no Japanese (en→ja) entries. RAG retrieval falls back to unfiltered top-k results.
- ❌ **`GET /health` route** — no health-check endpoint exists.
- ❌ **Rate limiting middleware** — no server-side request throttling (e.g. Flask-Limiter) to protect against hitting HF's free-tier rate limits.
- ❌ **Automated tests** — no `test_app.py` or test suite.
- ❌ **Production server** — `app.py` runs with `debug=True`; no WSGI/Gunicorn configuration for production deployment.

---

## Roadmap

Based on the [PHASES.md](PHASES.md) build plan and gaps identified in the codebase:

- [x] **Phase 1** — Project setup & boilerplate (Flask skeleton, folder structure, dependencies)
- [x] **Phase 2** — RAG pipeline (local embeddings, FAISS index, HF Inference API integration)
- [x] **Phase 3** — Brutalist frontend UI (complete with loading/error states and responsive layout)
- [ ] **Phase 4** — Integration & testing (add `/health` route, rate limiting, `test_app.py` with pytest)
- [ ] **Phase 5** — Documentation, deliverables & submission prep (blog post, demo video, submission package)

**Additional improvements to consider:**

- [ ] Add Japanese parallel corpus entries to `data/corpus.txt`
- [ ] Add a production-ready WSGI configuration (Gunicorn / Waitress)
- [ ] Persist the FAISS index to disk to avoid re-computing embeddings on every restart

---

## License / Author

*License and author information to be added.*
