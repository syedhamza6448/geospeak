# GeoSpeak — Project Report

**Project Name:** GeoSpeak  
**Theme:** Language Master  
**Category:** GenAI Smart Solutions  
**Contest:** Contest-AZM 2026 (Aptech Learning)  
**Version:** 1.0  
**Date:** August 2026  

---

## Table of Contents

1. [Problem Definition](#1-problem-definition)
2. [Design Specifications](#2-design-specifications)
3. [User Flow Diagram](#3-user-flow-diagram)
4. [Detailed Steps to Execute the Project](#4-detailed-steps-to-execute-the-project)
5. [Test Data](#5-test-data)
6. [Project Installation Instructions](#6-project-installation-instructions)
7. [Assumptions](#7-assumptions)

---

## 1. Problem Definition

Language is the most fundamental barrier to human communication. In an increasingly globalised world, individuals, businesses, educators, and governments must regularly exchange information across linguistic boundaries — yet accurate, affordable, and real-time translation remains out of reach for most people. Existing proprietary solutions such as Google Translate and DeepL depend on expensive cloud APIs that are cost-prohibitive for students, independent developers, and resource-constrained organisations.

The problem this project addresses is twofold. First, how can a language translation tool be built that leverages the latest advances in generative AI — including Large Language Models and semantic vector search — without incurring any API costs? Second, how can such a tool provide contextually aware translations that go beyond word-for-word substitution, preserving nuance, phrasing, and cultural register?

**GeoSpeak** answers both questions. It is a web application that implements a Retrieval-Augmented Generation (RAG) pipeline using an entirely free and open-source technology stack: local sentence embeddings, FAISS vector search, and the Hugging Face free-tier Inference API. Users can translate English text into French, Spanish, German, Urdu, and Japanese through an intuitive browser interface — with no subscription, no API billing, and no data sent to any paid service.

---

## 2. Design Specifications

### 2.1 Architecture Overview

GeoSpeak follows a **Retrieval-Augmented Generation (RAG)** architecture. The pipeline has four stages:

```
User Input (English text + target language)
        |
        v
Stage 1 — Local Embedding
  sentence-transformers/all-MiniLM-L6-v2
  Runs locally, zero API cost
  Output: 384-dim float32 vector
        |
        v
Stage 2 — Vector Similarity Search
  FAISS IndexFlatIP (cosine similarity)
  In-memory index of corpus embeddings
  Retrieves top-3 language-filtered
  parallel translation examples
        |
        v
Stage 3 — Prompt Construction
  Few-shot instruction prompt
  Includes retrieved examples +
  "Translate to {lang}: '{text}'"
        |
        v
Stage 4 — LLM Translation
  Hugging Face Inference API (free)
  Model: meta-llama/Llama-3.2-3B-Instruct:featherless-ai
  Output: cleaned translated text
        |
        v
  Translated text -> UI
```

### 2.2 Component Details

| Component | Technology | Role |
|---|---|---|
| Web Framework | Flask 3.x | HTTP routing, JSON API, template rendering |
| Embedding Model | `sentence-transformers/all-MiniLM-L6-v2` | Converts text to 384-dim semantic vectors; runs 100% locally |
| Vector Database | FAISS `IndexFlatIP` | In-memory cosine-similarity index over corpus embeddings |
| Translation LLM | `meta-llama/Llama-3.2-3B-Instruct` (Featherless AI via HF router) | Few-shot instruction-following translation |
| Corpus | `data/corpus.txt` | 48 pipe-delimited parallel translation pairs (en->fr/es/de/ur) |
| Frontend | HTML5 + Vanilla CSS + JavaScript | Brutalist-themed single-page UI |
| Environment Config | python-dotenv | Loads `HUGGINGFACE_API_KEY` from `.env` securely |
| Test Framework | pytest + unittest.mock | 5 automated tests for the `/translate` endpoint |

### 2.3 API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/` | Serves the main HTML UI | None |
| `POST` | `/translate` | Accepts `{"text":"...","target_lang":"..."}`, returns `{"translation":"..."}` | None (server-side HF key) |
| `GET` | `/health` | Returns `{"status":"ok"}` for liveness checks | None |

### 2.4 Security Design

- The Hugging Face API key is stored server-side in `.env` and **never transmitted to the browser**.
- The `.env` file is listed in `.gitignore` to prevent accidental commit.
- All user inputs are validated server-side (empty text, length limit, language whitelist).
- In-memory per-IP rate limiting (10 requests per 60 seconds) guards against free-tier API exhaustion.

### 2.5 Error Handling Strategy

| Error Condition | HTTP Code | Error Code | Behaviour |
|---|---|---|---|
| Empty input text | 400 | `EMPTY_TEXT` | Rejected before reaching pipeline |
| Text > 1000 chars | 400 | `TEXT_TOO_LONG` | Rejected before reaching pipeline |
| Unsupported language | 400 | `UNSUPPORTED_LANGUAGE` | Rejected before reaching pipeline |
| Rate limit exceeded | 429 | `RATE_LIMIT` | Client message: wait 60 s |
| HF model cold-start (503) | 500 | `MODEL_COLD_START` | Auto-retries 5x with exponential backoff |
| HF auth failure (401) | 500 | `AUTH_ERROR` | Prompts user to check `.env` token |
| HF permission denied (403) | 500 | `PERMISSION_DENIED` | Prompts user to regenerate fine-grained token |
| Network / timeout | 500 | `INTERNAL_ERROR` | Structured JSON error with details |

---

## 3. User Flow Diagram

```
User Opens Browser -> http://127.0.0.1:5000
        |
        v
GeoSpeak UI loads (index.html)
Output panel: AWAITING INPUT
        |
        v
User types source text in textarea
(character counter updates live: 0/1000)
        |
        v
User selects target language from dropdown
(French / Spanish / German / Urdu / Japanese)
        |
        v
User clicks TRANSLATE NOW  (or Ctrl+Enter)
        |
   [Client-side validation]
        |
  FAIL: empty / too long / no language selected
        |                  |
        v                  v (PASS)
  Show ERROR panel    Output panel -> TRANSLATING...
                      Button disabled
                             |
                             v
                    POST /translate (fetch API)
                    body: {text, target_lang}
                             |
                    [Server-side validation]
                             |
              FAIL           |           PASS
                |            v            |
                v      Embed input text   v
          Return 400   FAISS top-3 search
          Error panel  Build few-shot prompt
          shown        Call HF Inference API
                             |
                   [HF API Response]
                             |
              ERROR          |           200 OK
                |            |            |
                v            |            v
          Return 4xx/5xx     |     Return {translation}
          Error panel shown  |     Output panel:
                             |     TRANSLATION + badge
                             |     (RTL for Urdu/Arabic)
                                         |
                                         v
                                  User clicks [COPY]
                                  -> Clipboard + "COPIED!"
```

---

## 4. Detailed Steps to Execute the Project

### Prerequisites

- Python 3.9 or higher installed
- Internet connection (for model download on first run and HF API calls)
- A free Hugging Face account

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-username>/geospeak.git
cd geospeak
```

### Step 2 — Create a Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

Expected packages installed: flask, sentence-transformers, faiss-cpu, numpy, python-dotenv, requests, huggingface_hub, pytest, pytest-mock.

> **Note:** `sentence-transformers` will download the `all-MiniLM-L6-v2` model (~80 MB) on first use. This only happens once; subsequent runs use the local cache.

### Step 4 — Obtain a Free Hugging Face API Token

1. Go to https://huggingface.co/settings/tokens
2. Click **New token**
3. Give it a name (e.g. `geospeak-token`)
4. Under **Token type**, select **Fine-grained**
5. Under **Permissions**, enable **"Make calls to Inference Providers"**
6. Click **Generate token** and copy the value (`hf_...`)

### Step 5 — Configure Environment Variables

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` in any text editor and set:

```env
HUGGINGFACE_API_KEY=hf_your_actual_token_here
```

### Step 6 — Run the Application

```bash
python app.py
```

You will see output similar to:

```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
[INFO] Loading sentence-transformers model (all-MiniLM-L6-v2)...
[INFO] FAISS index built: 48 vectors, dim=384
```

### Step 7 — Open the Application in a Browser

Navigate to:

```
http://127.0.0.1:5000
```

### Step 8 — Test a Translation

1. Type any English text in the **SOURCE TEXT** box (e.g. `Where is the nearest hospital?`)
2. Select a target language from the dropdown (e.g. `URDU`)
3. Click **TRANSLATE NOW**
4. Wait 5–40 seconds on first request (HF model cold-start)
5. The translated text appears in the **OUTPUT** panel (right-aligned for Urdu)

### Step 9 — Run the Automated Test Suite

```bash
pytest test_app.py -v
```

Expected output:

```
test_app.py::test_valid_translation      PASSED
test_app.py::test_empty_text             PASSED
test_app.py::test_unsupported_language   PASSED
test_app.py::test_text_too_long          PASSED
test_app.py::test_hf_api_failure         PASSED

5 passed in X.XXs
```

---

## 5. Test Data

| # | Input Text | Target Language | Expected Behaviour | Expected HTTP |
|---|---|---|---|---|
| 1 | `Hello, how are you?` | French | Returns French greeting phrase | 200 OK |
| 2 | `Good morning!` | Spanish | Returns Spanish morning greeting | 200 OK |
| 3 | `Where is the nearest hospital?` | Urdu | Returns Urdu script, displayed right-aligned (RTL) | 200 OK |
| 4 | `Thank you very much.` | German | Returns German thanks phrase | 200 OK |
| 5 | `I would like a glass of water.` | Japanese | Returns Japanese text (LLM-only, no corpus RAG examples) | 200 OK |
| 6 | *(empty string)* | French | Error code `EMPTY_TEXT` | 400 Bad Request |
| 7 | `Hello` | Italian | Error code `UNSUPPORTED_LANGUAGE` | 400 Bad Request |
| 8 | `A` x 1001 characters | French | Error code `TEXT_TOO_LONG` | 400 Bad Request |
| 9 | `Hello` | *(no language selected)* | Client-side validation error, no fetch sent | N/A |
| 10 | `Hello` (11th rapid request, same IP) | French | Error code `RATE_LIMIT` | 429 Too Many Requests |

---

## 6. Project Installation Instructions

See [Section 4](#4-detailed-steps-to-execute-the-project) for the complete step-by-step guide.

**Quick-start summary:**

```bash
git clone https://github.com/<username>/geospeak.git
cd geospeak
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # then add your HF token
python app.py
# Open http://127.0.0.1:5000
```

**GitHub Repository:** *(Add your public GitHub link here)*  
**Blog Post:** *(Add your published blog link here)*

---

## 7. Assumptions

| # | Assumption |
|---|---|
| 1 | **Source language is always English.** The corpus and prompts are designed for English to target language translation only. |
| 2 | **Input text limit is 1000 characters.** Inputs beyond this are rejected to avoid excessive API token usage. |
| 3 | **Supported target languages are fixed:** French, Spanish, German, Urdu, Japanese. |
| 4 | **Corpus covers French, Spanish, German, and Urdu only.** Japanese is supported via the LLM but has no dedicated RAG corpus examples; retrieval falls back to unfiltered top-k results. |
| 5 | **Internet connection is required.** The Hugging Face Inference API is a remote service. Offline translation is not supported. |
| 6 | **The sentence-transformer model is cached locally after first download (~80 MB).** Subsequent startups do not require re-downloading the model. |
| 7 | **Hugging Face free-tier rate limits apply.** Under sustained load, users may encounter `429 RATE_LIMIT` errors. |
| 8 | **Cold-start delays of 20–40 seconds are expected on the first request** after the HF model has been idle. The app retries automatically up to 5 times. |
| 9 | **The app is intended for demonstration/development use only.** It runs on Flask's built-in development server and is not hardened for production deployment. |
| 10 | **No user authentication or session management is implemented.** The app is stateless and all state is local to the browser session. |
| 11 | **No persistent storage.** The FAISS index is rebuilt in memory on every startup. Translation history is not saved. |
| 12 | **Rate limiting is in-memory and per-process.** Counters reset on Flask restart. |
| 13 | **The Hugging Face API key must have "Make calls to Inference Providers" permission.** Standard read-only tokens will receive a 403 PERMISSION_DENIED error. |
| 14 | **The application runs on http://localhost:5000 by default.** No HTTPS/TLS is configured; this is acceptable for local demo purposes. |
