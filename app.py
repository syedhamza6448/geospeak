import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Retrieve the Hugging Face API key — never expose this to the client
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

app = Flask(__name__)


@app.route("/")
def index():
    """Render the main GeoSpeak UI."""
    return render_template("index.html")


@app.route("/translate", methods=["POST"])
def translate():
    """
    Placeholder translation endpoint.
    Phase 2 will replace this with the full RAG + HF Inference pipeline.
    """
    # TODO (Phase 2): parse request JSON, run RAG pipeline, call HF API
    return jsonify({"translation": "test"})


if __name__ == "__main__":
    app.run(debug=True)
