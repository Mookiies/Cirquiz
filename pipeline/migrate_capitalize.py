"""Migrate existing questions to capitalize the first letter of all answer fields.

Applies to: correct_answer, distractor_1, distractor_2, distractor_3
Skips: seed questions (assumed hand-authored and intentionally cased)

Run from the pipeline directory:

    python migrate_capitalize.py
    python migrate_capitalize.py --db /path/to/generation.db
    python migrate_capitalize.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent))

from config import DB_PATH
from models.db import Question, init_db


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def run(db_path: str, dry_run: bool = False) -> None:
    engine = init_db(db_path)

    with Session(engine) as session:
        questions = session.exec(
            select(Question).where(Question.source_type != "seed")
        ).all()

        changed = 0
        for q in questions:
            new_correct = _cap(q.correct_answer or "")
            new_d1 = _cap(q.distractor_1 or "")
            new_d2 = _cap(q.distractor_2 or "")
            new_d3 = _cap(q.distractor_3 or "")

            if (
                new_correct != q.correct_answer
                or new_d1 != q.distractor_1
                or new_d2 != q.distractor_2
                or new_d3 != q.distractor_3
            ):
                if not dry_run:
                    q.correct_answer = new_correct
                    q.distractor_1 = new_d1
                    q.distractor_2 = new_d2
                    q.distractor_3 = new_d3
                    session.add(q)
                changed += 1

        if not dry_run:
            session.commit()

    label = "[DRY RUN] Would update" if dry_run else "Updated"
    print(f"{label} {changed} question(s) out of {len(questions)} total.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Capitalize first letter of all answer fields.")
    parser.add_argument("--db", default=str(DB_PATH), help="Path to generation.db")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()
    run(args.db, dry_run=args.dry_run)
