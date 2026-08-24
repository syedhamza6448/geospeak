import sys
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

import json
from app import app, build_index

def run_tests():
    build_index()
    client = app.test_client()

    print("--- Test 1: Japanese General Phrase ---")
    res_ja1 = client.post('/translate', json={
        "text": "Where is the nearest hospital?",
        "target_lang": "Japanese"
    })
    print("Response Status:", res_ja1.status_code)
    print("Response JSON:", res_ja1.json)

    print("\n--- Test 2: Japanese Idiom ---")
    res_ja2 = client.post('/translate', json={
        "text": "It's raining cats and dogs.",
        "target_lang": "Japanese"
    })
    print("Response Status:", res_ja2.status_code)
    print("Response JSON:", res_ja2.json)

if __name__ == "__main__":
    run_tests()
