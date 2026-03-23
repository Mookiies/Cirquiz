"""Pipeline configuration defaults."""

import os
from pathlib import Path
from typing import Literal

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
DEDUP_THRESHOLD: float = 0.83

# ── Source data ────────────────────────────────────────────────────────────
# HuggingFace wikipedia dataset config string. Options:
#   "20220301.simple"  — Simple English Wikipedia (~200k articles, cleaner prose)
#   "20220301.en"      — Full English Wikipedia (~6M articles)
WIKIPEDIA_DATASET: str = os.environ.get("WIKIPEDIA_DATASET", "20220301.simple")

# ── Generation ─────────────────────────────────────────────────────────────
# Number of questions to generate per Wikipedia source chunk.
QUESTIONS_PER_CHUNK: int = 1

# Checkpoint write frequency (every N processed chunks).
CHECKPOINT_INTERVAL: int = 10

# ── Categories ─────────────────────────────────────────────────────────────
# Single source of truth. Slugs are used everywhere — pipeline DB, export DB, and app.
CategoryLiteral = Literal[
    "arts_and_literature",
    "film_and_tv",
    "general_knowledge",
    "geography",
    "history",
    "music",
    "science",
    "sport_and_leisure",
    "society_and_culture",
    "food_and_drink",
]

CATEGORIES: list[str] = list(CategoryLiteral.__args__)  # type: ignore[attr-defined]
