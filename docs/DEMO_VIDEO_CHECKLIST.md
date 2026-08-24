# GeoSpeak — Demo Video Checklist

Use this checklist before and during recording your demo video (.mp4).
Keep the video between **3–6 minutes** for the best evaluator experience.

---

## Before You Start Recording

- [ ] Flask server is running: `python app.py`
- [ ] Browser is open at `http://127.0.0.1:5000` and fully loaded
- [ ] Browser zoom is at 100% (or comfortable for screen recording)
- [ ] Close unnecessary browser tabs and notifications
- [ ] Open terminal/console beside or behind the browser so server logs are visible (optional but impressive)
- [ ] Test one translation beforehand to pre-warm the HF model and avoid cold-start during recording

---

## Scene 1 — Introduction (30 seconds)

- [ ] Show the GeoSpeak homepage (`http://127.0.0.1:5000`)
- [ ] Narrate: "This is GeoSpeak — an AI-powered translation app built on a 100% free tech stack using RAG, FAISS, and the Hugging Face Inference API"
- [ ] Point out the brutalist design: the GEOSPEAK heading, input panel, output panel

---

## Scene 2 — Successful Translation: French (45 seconds)

- [ ] Type `Hello, how are you?` in the source text box
- [ ] Show the character counter updating
- [ ] Select **FRENCH** from the dropdown
- [ ] Click **TRANSLATE NOW**
- [ ] Show the TRANSLATING... loading state with the pulsing animation
- [ ] Wait for the result — show the French translation in the output panel with the FRENCH badge
- [ ] Click **[COPY]** and show the "COPIED!" confirmation

---

## Scene 3 — Successful Translation: Urdu (RTL) (45 seconds)

- [ ] Clear the source text
- [ ] Type `Where is the nearest hospital?`
- [ ] Select **URDU** from the dropdown
- [ ] Click **TRANSLATE NOW**
- [ ] Highlight the output: Urdu script appears **right-aligned and right-to-left**
- [ ] Narrate: "GeoSpeak automatically detects right-to-left languages and adjusts text direction accordingly"

---

## Scene 4 — Additional Languages (30 seconds)

- [ ] Quickly show one translation to **Spanish** (e.g. `Good morning!` → `¡Buenos días!`)
- [ ] Quickly show one translation to **German** (e.g. `Thank you very much.` → `Vielen Dank.`)
- [ ] Quickly show one translation to **Japanese** (e.g. `I don't understand.`)

---

## Scene 5 — Error Handling (60 seconds)

- [ ] **Empty text test:** Click TRANSLATE NOW with an empty textarea — show the `INPUT IS EMPTY` error panel
- [ ] **Unsupported language:** Attempt to submit with no language selected — show the `LANGUAGE NOT SUPPORTED` error
- [ ] **Text too long:** Paste 1001+ characters — show the character counter turn red and the `TEXT TOO LONG` error
- [ ] Narrate: "All errors are displayed with clear, user-friendly messages and recovery hints"

---

## Scene 6 — Cold-Start Behaviour (optional, ~30 seconds)

- [ ] If you can reproduce a cold-start: show the TRANSLATING... state persisting for 20+ seconds
- [ ] Show the loading note: "First request may take 20–40s due to Hugging Face free-tier cold start"
- [ ] Narrate: "This is a known limitation of the free tier — the app retries automatically up to 5 times"

---

## Scene 7 — Health Endpoint (15 seconds)

- [ ] Open a new browser tab and navigate to `http://127.0.0.1:5000/health`
- [ ] Show the JSON response: `{"status": "ok"}`
- [ ] Narrate: "The app exposes a health-check endpoint for uptime monitoring"

---

## Scene 8 — Automated Tests (30 seconds)

- [ ] Switch to the terminal
- [ ] Run: `pytest test_app.py -v`
- [ ] Show all 5 tests passing with green output
- [ ] Narrate: "The test suite covers valid requests, empty input, unsupported language, text too long, and simulated API failure"

---

## Scene 9 — Architecture Explanation (optional, 30–60 seconds)

- [ ] Briefly show `app.py` open in your editor — highlight `build_index()`, `retrieve_examples()`, `call_hf_api()`
- [ ] Narrate the 4-stage pipeline: "Local embedding → FAISS search → few-shot prompt → Hugging Face LLM"
- [ ] Mention: "No paid APIs, no OpenAI, everything is open-source and free"

---

## Scene 10 — Closing (15 seconds)

- [ ] Return to the browser showing the GeoSpeak UI
- [ ] Briefly mention: "GeoSpeak was built in 2 days using Flask, sentence-transformers, FAISS, and Llama 3.2 — entirely free"
- [ ] Mention the GitHub link and blog post link

---

## Final Checklist Before Export

- [ ] Video is in `.mp4` format
- [ ] Audio is clear (no background noise)
- [ ] All 5 supported languages were demonstrated
- [ ] Error handling was shown
- [ ] Automated tests were shown passing
- [ ] Video length is between 3–6 minutes
