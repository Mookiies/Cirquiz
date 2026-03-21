"""Pipeline configuration defaults."""

import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
PIPELINE_DIR = Path(__file__).parent
DB_PATH = PIPELINE_DIR / "generation.db"
EXPORT_PATH = PIPELINE_DIR / "export" / "cirquiz_questions.db"
LOGS_DIR = PIPELINE_DIR / "logs"

# ── Model ──────────────────────────────────────────────────────────────────
MODEL_NAME = os.environ.get("PIPELINE_MODEL", "mlx-community/Mistral-7B-Instruct-v0.2-4bit")

# ── Quality thresholds ─────────────────────────────────────────────────────
# Questions at or above this score are auto-approved; below goes to review.
CONFIDENCE_THRESHOLD: float = 0.85

# Cosine similarity at or above this value marks a question as a near-duplicate.
DEDUP_THRESHOLD: float = 0.92

# ── Source data ────────────────────────────────────────────────────────────
WIKIPEDIA_DUMP_URL = (
    "https://dumps.wikimedia.org/simplewiki/latest/"
    "simplewiki-latest-pages-articles.xml.bz2"
)
WIKIPEDIA_DUMP_PATH = PIPELINE_DIR / "simplewiki-latest-pages-articles.xml.bz2"

# ── Generation ─────────────────────────────────────────────────────────────
# Number of questions to generate per Wikipedia source chunk.
QUESTIONS_PER_CHUNK: int = 3

# Checkpoint write frequency (every N processed chunks).
CHECKPOINT_INTERVAL: int = 10

# ── Categories ─────────────────────────────────────────────────────────────
CATEGORIES: list[str] = [
    "Arts & Literature",
    "Film & TV",
    "General Knowledge",
    "Geography",
    "History",
    "Music",
    "Science",
    "Sport & Leisure",
    "Society & Culture",
    "Food & Drink",
]

CATEGORY_SLUGS: dict[str, str] = {
    "Arts & Literature": "arts_and_literature",
    "Film & TV": "film_and_tv",
    "General Knowledge": "general_knowledge",
    "Geography": "geography",
    "History": "history",
    "Music": "music",
    "Science": "science",
    "Sport & Leisure": "sport_and_leisure",
    "Society & Culture": "society_and_culture",
    "Food & Drink": "food_and_drink",
}
