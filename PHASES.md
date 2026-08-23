# GeoSpeak — Build Prompts (Free-Tier Stack)

A 5-phase build plan for GeoSpeak, designed to be completed in 2 days using a **100% free tech stack** — no paid API costs. Check off each phase as you complete it, and paste the corresponding prompt into Claude Code / Cursor / Claude chat.

**Free-tier stack swap:**
- ~~OpenAI Embeddings~~ → **sentence-transformers** (`all-MiniLM-L6-v2`) — runs locally, no API key, no cost
- ~~OpenAI GPT (chat completion)~~ → **Hugging Face Inference API** (free tier) using an open model like `mistralai/Mistral-7B-Instruct-v0.2` or a dedicated translation model like `facebook/nllb-200-distilled-600M`
- Vector DB stays **FAISS** (free, local)
- Everything else (Flask, HTML5/CSS/JS) unchanged

> Note: Hugging Face's free Inference API tier is rate-limited and can have cold-start delays on first request — mention this in your documentation/demo video as a known limitation.

---

## ☑ Phase 1 — Project Setup & Boilerplate ✅
*(Day 1, ~1 hr)*

**Goal:** Flask skeleton, folder structure, free-tier dependencies, Hugging Face key wiring.

```
Set up a Flask project called "GeoSpeak" with this structure:

geospeak/
  app.py
  requirements.txt
  .env.example
  /data
    corpus.txt
  /static
    style.css
    script.js
  /templates
    index.html

requirements.txt should include: flask, sentence-transformers, faiss-cpu, numpy, 
python-dotenv, requests, huggingface_hub.
app.py should load HUGGINGFACE_API_KEY from a .env file using python-dotenv 
(this is a free token from huggingface.co/settings/tokens), initialize a Flask app, 
and have a placeholder route "/" that renders index.html and a placeholder 
POST route "/translate" that returns a dummy JSON response {"translation": "test"}.
Also give me the exact pip install / run commands to get this running locally, 
and tell me how to get a free Hugging Face API token.
```

---

## ☑ Phase 2 — RAG Pipeline (Free Embeddings + Vector DB + Free LLM Translation) ✅
*(Day 1, ~3 hrs — the core engine)*

**Goal:** Build the GenAI pipeline using entirely free tools: local embeddings + FAISS + Hugging Face's free Inference API for translation.

```
In app.py, implement the GeoSpeak translation pipeline using a fully free stack:

1. Load a small parallel corpus from /data/corpus.txt (format: 
   "source_lang|target_lang|source_text|target_text" per line, ~30-50 example rows 
   covering English-to-French/Spanish/German/Urdu common phrases). Generate this 
   sample corpus file for me too.

2. On app startup, load the "sentence-transformers/all-MiniLM-L6-v2" model 
   locally (no API calls, no cost) and compute embeddings for all corpus 
   source_text entries. Build a FAISS index in memory from these embeddings.

3. Create a function get_translation(text, target_lang) that:
   - Embeds the input text locally using the same sentence-transformers model
   - Searches FAISS for the top 3 most similar corpus examples
   - Builds a context-aware prompt including those examples plus the instruction 
     "Translate the following text to {target_lang}: '{text}'"
   - Sends this prompt to the Hugging Face Inference API (free tier) using 
     the HUGGINGFACE_API_KEY, calling a hosted model such as 
     "mistralai/Mistral-7B-Instruct-v0.2" for general instruction-following 
     translation, OR "facebook/nllb-200-distilled-600M" if we want a model 
     purpose-built for translation (explain the tradeoff between these two 
     options briefly in comments)
   - Parses and returns just the translated text cleanly, stripping any 
     extra model commentary

4. Wire this into the POST /translate route, which accepts JSON 
   {"text": "...", "target_lang": "..."} and returns {"translation": "..."}.

5. Add try/except error handling at every step (embedding failure, empty FAISS 
   index, Hugging Face API errors, rate-limit responses, cold-start timeouts) 
   and return meaningful JSON error messages with proper HTTP status codes 
   instead of crashing. Include a retry-with-backoff for HF's model 
   cold-start (503) responses.
```

---

## ☑ Phase 3 — Brutalist Frontend UI ✅
*(Day 1 evening / Day 2 morning, ~2 hrs)*

**Goal:** Raw, high-contrast, brutalist-style UI — thick borders, harsh shadows, mono fonts, no rounded corners, minimal color palette.

```
Build a brutalist-style frontend for GeoSpeak in templates/index.html and 
static/style.css. Brutalist design requirements:

- Monospace font (e.g., "Space Mono", "JetBrains Mono", or system monospace)
- Pure black borders (3-5px solid), no border-radius anywhere
- Harsh drop shadows (offset, no blur) e.g. box-shadow: 6px 6px 0px #000
- High-contrast palette: black, white, and ONE loud accent color (e.g. 
  acid yellow #F5FF00 or red #FF3B30)
- Oversized, all-caps headings with tight letter spacing
- Visible raw HTML structure feel — exposed grid lines, blocky buttons with 
  no hover transitions (or instant snap transitions only)
- No soft gradients, no subtle shadows, no rounded UI elements anywhere

Layout:
- Header: "GEOSPEAK" in huge bold uppercase text
- A textarea for source text input
- A dropdown for target language (French, Spanish, German, Urdu, Japanese)
- A big blocky "TRANSLATE NOW" button
- An output panel below showing the translated text in a bordered box
- A loading state that shows "TRANSLATING..." with a blocky pulsing animation 
  (no smooth spinners) — mention this may take longer than usual on first 
  request due to Hugging Face's free-tier model cold start
- Error state styled as a red-bordered alert box, including a specific message 
  for rate-limit/cold-start errors (e.g. "MODEL WARMING UP — RETRY IN 20s")

Then write static/script.js to call POST /translate via fetch, handle loading 
and error states, and display the result in the output panel.
```

---

## ☑ Phase 4 — Integration, Testing & Edge Cases ✅
*(Day 2 morning, ~2 hrs)*

**Goal:** Make sure the app actually works end-to-end and handles the non-functional requirements (security, reliability, error handling) within free-tier constraints.

```
Review the full GeoSpeak Flask app (app.py, templates, static) and:

1. Add input validation on the /translate route (reject empty text, reject 
   text over a reasonable length limit, validate target_lang is in an allowed list).
2. Add basic rate limiting or a simple in-memory request throttle to avoid 
   hitting Hugging Face's free-tier rate limits too quickly (use Flask-Limiter 
   if available, otherwise a simple timestamp check).
3. Make sure the Hugging Face API token is never exposed to the frontend/client-side.
4. Add a simple health-check route GET /health that returns {"status": "ok"}.
5. Write 5 sample test cases (as a test_app.py using pytest) covering:
   - valid translation request
   - empty text input
   - unsupported target language
   - very long text input
   - simulated Hugging Face API failure/cold-start (mock the HF call)
6. Give me a checklist of manual test scenarios I should run in the browser 
   before recording the demo video, including testing behavior when the free 
   HF model is cold-starting.
```

---

## ☐ Phase 5 — Documentation, Deliverables & Submission Prep
*(Day 2 afternoon/evening, ~2-3 hrs)*

**Goal:** Everything Aptech's SRS requires for grading — this is where most points get lost if skipped.

```
Help me finalize GeoSpeak's submission package:

1. Write a Problem Definition section (150-200 words) explaining the language 
   barrier problem GeoSpeak solves.
2. Write Design Specifications summarizing the architecture (local embedding 
   model → FAISS vector DB → context-aware prompt → Hugging Face-hosted LLM → 
   output), noting this is a fully free/open-source stack.
3. Describe a User Flow Diagram in text form (steps a user takes from landing 
   on the page to getting a translation) that I can turn into a simple diagram.
4. Write step-by-step "Detailed steps to execute the project" instructions 
   (clone repo, install deps, get a free Hugging Face token, set it in .env, 
   run Flask, use the UI).
5. Generate a sample Test Data table (5-10 rows: input text, target language, 
   expected translation behavior).
6. Write a ReadMe.doc-style assumptions list (e.g., corpus size assumptions, 
   supported languages, free-tier rate limits/cold-starts as a known limitation, 
   no offline mode, etc.)
7. Draft an outline for a 2000+ word blog post about building GeoSpeak 
   (introduction, problem, architecture, why a free/open-source stack was chosen, 
   challenges with free-tier rate limits, lessons learned, conclusion) that I 
   can expand and publish on Medium/Blogger.
8. Give me a checklist of everything to record in the demo video walkthrough.
```

---

## Suggested 2-Day Timeline

| When | Phase |
|---|---|
| Day 1, morning | Phase 1 — Setup |
| Day 1, midday–afternoon | Phase 2 — RAG pipeline (hardest part, budget the most time here) |
| Day 1, evening | Phase 3 — Brutalist UI |
| Day 2, morning | Phase 4 — Integration & testing |
| Day 2, afternoon–evening | Phase 5 — Docs, blog, video, GitHub push |

## Cost Note

This stack should run at **$0 cost**:
- Sentence-transformers and FAISS run entirely locally — no API calls, no billing.
- Hugging Face Inference API's free tier has rate limits (varies by model/account) 
  but no charge for typical light testing/demo usage.
- If you hit persistent rate-limit issues close to your deadline, consider running 
  a small model locally via **Ollama** (e.g., `mistral` or `llama3.2`) as a backup — 
  also free, but requires more local compute/RAM.