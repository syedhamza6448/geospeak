"""
build_index_offline.py

Run this ONCE, locally on your own machine (not on Render), to precompute
the FAISS index and corpus embeddings ahead of time. This avoids doing the
expensive embedding computation at server startup, which was causing
out-of-memory kills on Render's free 512MB tier.

Usage:
    pip install fastembed faiss-cpu numpy
    python build_index_offline.py

Output:
    data/faiss_index.bin   — the prebuilt FAISS index
    data/corpus_meta.json  — corpus entries, in the same order as the index

After running this, commit both output files to your repo and push to Render.
app.py will load them directly instead of recomputing embeddings at startup.
"""

import os
import json
import numpy as np
import faiss
from fastembed import TextEmbedding

CORPUS_PATH = os.path.join(os.path.dirname(__file__), "data", "corpus.txt")
INDEX_OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "faiss_index.bin")
META_OUT_PATH = os.path.join(os.path.dirname(__file__), "data", "corpus_meta.json")


def load_corpus(path):
    entries = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) != 4:
                print(f"Skipping malformed line: {line}")
                continue
            entries.append({
                "source_lang": parts[0].strip(),
                "target_lang": parts[1].strip(),
                "source_text": parts[2].strip(),
                "target_text": parts[3].strip(),
            })
    return entries


def main():
    print("Loading corpus...")
    corpus_entries = load_corpus(CORPUS_PATH)
    print(f"Loaded {len(corpus_entries)} entries.")

    print("Loading embedding model (fastembed, all-MiniLM-L6-v2)...")
    model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

    source_texts = [e["source_text"] for e in corpus_entries]
    print(f"Computing embeddings for {len(source_texts)} entries...")
    embeddings = np.array(list(model.embed(source_texts)), dtype="float32")
    faiss.normalize_L2(embeddings)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    print(f"Built FAISS index: {index.ntotal} vectors, dim={dim}")

    os.makedirs(os.path.dirname(INDEX_OUT_PATH), exist_ok=True)
    faiss.write_index(index, INDEX_OUT_PATH)
    with open(META_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(corpus_entries, f, ensure_ascii=False, indent=2)

    print(f"Saved index to {INDEX_OUT_PATH}")
    print(f"Saved metadata to {META_OUT_PATH}")
    print("Done. Commit these two files and push to your repo.")


if __name__ == "__main__":
    main()