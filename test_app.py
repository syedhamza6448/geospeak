"""
test_app.py — pytest test suite for GeoSpeak /translate endpoint.

Covers:
  1. Valid translation (mocked HF API)
  2. Empty text → 400 EMPTY_TEXT
  3. Unsupported target language → 400 UNSUPPORTED_LANGUAGE
  4. Text over 1000 characters → 400 TEXT_TOO_LONG
  5. HF API failure (ConnectionError) → 500 INTERNAL_ERROR
"""

import pytest
from unittest.mock import patch, MagicMock
import requests


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def client():
    """
    Create a Flask test client.
    Patches the before_request hook so we never load the heavy
    sentence-transformers model or FAISS index during tests.
    """
    from app import app

    # Disable the before_request that loads ML models
    app.before_request_funcs = {}

    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# 1. Valid translation — mock HF API to return a fake response
# ---------------------------------------------------------------------------
def test_valid_translation(client):
    """POST /translate with valid input returns 200 and a 'translation' key."""
    fake_hf_response = MagicMock()
    fake_hf_response.status_code = 200
    fake_hf_response.json.return_value = {
        "choices": [
            {"message": {"content": "Bonjour le monde"}}
        ]
    }

    with patch("app.requests.post", return_value=fake_hf_response):
        resp = client.post("/translate", json={
            "text": "Hello world",
            "target_lang": "French",
        })

    assert resp.status_code == 200
    data = resp.get_json()
    assert "translation" in data
    assert data["translation"] == "Bonjour le monde"


# ---------------------------------------------------------------------------
# 2. Empty text input → 400 EMPTY_TEXT
# ---------------------------------------------------------------------------
def test_empty_text(client):
    """POST /translate with empty text returns 400 with code EMPTY_TEXT."""
    resp = client.post("/translate", json={
        "text": "",
        "target_lang": "French",
    })

    assert resp.status_code == 400
    data = resp.get_json()
    assert data["code"] == "EMPTY_TEXT"


# ---------------------------------------------------------------------------
# 3. Unsupported target language → 400 UNSUPPORTED_LANGUAGE
# ---------------------------------------------------------------------------
def test_unsupported_language(client):
    """POST /translate with unsupported language returns 400 with code UNSUPPORTED_LANGUAGE."""
    resp = client.post("/translate", json={
        "text": "Hello",
        "target_lang": "Italian",
    })

    assert resp.status_code == 400
    data = resp.get_json()
    assert data["code"] == "UNSUPPORTED_LANGUAGE"


# ---------------------------------------------------------------------------
# 4. Text over 1000 characters → 400 TEXT_TOO_LONG
# ---------------------------------------------------------------------------
def test_text_too_long(client):
    """POST /translate with >1000 chars returns 400 with code TEXT_TOO_LONG."""
    long_text = "A" * 1001

    resp = client.post("/translate", json={
        "text": long_text,
        "target_lang": "French",
    })

    assert resp.status_code == 400
    data = resp.get_json()
    assert data["code"] == "TEXT_TOO_LONG"


# ---------------------------------------------------------------------------
# 5. HF API failure — ConnectionError → 500 INTERNAL_ERROR
# ---------------------------------------------------------------------------
def test_hf_api_failure(client):
    """When HF API raises a ConnectionError, the app returns 500 with structured JSON."""
    with patch(
        "app.requests.post",
        side_effect=requests.exceptions.ConnectionError("Simulated network failure"),
    ):
        resp = client.post("/translate", json={
            "text": "Hello world",
            "target_lang": "French",
        })

    assert resp.status_code == 500
    data = resp.get_json()
    assert "error" in data
    assert data["code"] == "INTERNAL_ERROR"
