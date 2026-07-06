"""Insert hand-authored seed questions directly into the pipeline DB.

Seed questions bypass generate/validate/verify — they are inserted as
pre-approved. Run from the pipeline directory:

    python seed.py
    python seed.py --db /path/to/generation.db
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent))

from config import CATEGORIES, DB_PATH
from models.db import Question, SourceChunk, init_db

# ── Add your questions here ────────────────────────────────────────────────────
# category must be one of: arts_and_literature, film_and_tv, general_knowledge,
#   geography, history, music, science, sport_and_leisure, society_and_culture,
#   food_and_drink
# difficulty must be one of: easy, medium, hard

SEED_QUESTIONS = [
    # Add more questions in the same format:
    # dict(
    #     text="...",
    #     correct_answer="...",
    #     distractor_1="...",
    #     distractor_2="...",
    #     distractor_3="...",
    #     category="...",
    #     difficulty="easy|medium|hard",
    # ),
]

# ──────────────────────────────────────────────────────────────────────────────


def _validate(q: dict, index: int) -> list[str]:
    errors = []
    for field in ("text", "correct_answer", "distractor_1", "distractor_2", "distractor_3", "category", "difficulty"):
        if not q.get(field, "").strip():
            errors.append(f"  [{index}] missing or empty '{field}'")
    if q.get("category") and q["category"] not in CATEGORIES:
        errors.append(f"  [{index}] invalid category '{q['category']}' — must be one of: {', '.join(CATEGORIES)}")
    if q.get("difficulty") and q["difficulty"] not in ("easy", "medium", "hard"):
        errors.append(f"  [{index}] invalid difficulty '{q['difficulty']}' — must be easy, medium, or hard")
    return errors


def run(db_path: str) -> None:
    if not SEED_QUESTIONS:
        print("No seed questions defined — add entries to SEED_QUESTIONS and re-run.")
        return

    errors = []
    for i, q in enumerate(SEED_QUESTIONS):
        errors.extend(_validate(q, i))
    if errors:
        print("Validation errors — fix before inserting:\n" + "\n".join(errors))
        sys.exit(1)

    engine = init_db(db_path)

    inserted = 0
    skipped = 0
    with Session(engine) as session:
        for q in SEED_QUESTIONS:
            existing = session.exec(
                select(Question).where(Question.text == q["text"])
            ).first()
            if existing:
                print(f"  skipping (already exists): {q['text'][:60]}")
                skipped += 1
                continue

            chunk = SourceChunk(
                source_type="seed",
                source_title="seed",
                category=q["category"],
                text=q["text"],
                processed=True,
            )
            session.add(chunk)
            session.flush()

            question = Question(
                source_chunk_id=chunk.id,
                source_type="seed",
                text=q["text"],
                correct_answer=q["correct_answer"],
                distractor_1=q["distractor_1"],
                distractor_2=q["distractor_2"],
                distractor_3=q["distractor_3"],
                category=q["category"],
                difficulty=q["difficulty"],
                confidence_score=1.0,
                verified=True,
                human_approved=True,
                grounded=True,
                rejected=False,
                is_duplicate=False,
                original_text=q["text"],
                original_correct_answer=q["correct_answer"],
                original_distractor_1=q["distractor_1"],
                original_distractor_2=q["distractor_2"],
                original_distractor_3=q["distractor_3"],
                original_category=q["category"],
                original_difficulty=q["difficulty"],
            )
            session.add(question)
            inserted += 1

        session.commit()

    print(f"Inserted {inserted} seed question(s) into {db_path} ({skipped} skipped as duplicates)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Insert seed questions into the pipeline DB.")
    parser.add_argument("--db", default=str(DB_PATH), help="Path to generation.db")
    args = parser.parse_args()
    run(args.db)
