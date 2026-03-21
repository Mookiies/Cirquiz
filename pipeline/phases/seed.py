"""Phase 1: Load seed datasets into the generation database."""

from __future__ import annotations

import sys
from typing import Optional

from rich.console import Console
from rich.progress import track
from sqlmodel import Session, select

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))

from models.db import PipelineState, Question, init_db

console = Console()

# Jeopardy category → target category mapping (keyword-based)
_JEOPARDY_CATEGORY_MAP: dict[str, str] = {
    "HISTORY": "History",
    "AMERICAN HISTORY": "History",
    "WORLD HISTORY": "History",
    "SCIENCE": "Science",
    "SCIENCE & NATURE": "Science",
    "ASTRONOMY": "Science",
    "BIOLOGY": "Science",
    "CHEMISTRY": "Science",
    "PHYSICS": "Science",
    "GEOGRAPHY": "Geography",
    "WORLD GEOGRAPHY": "Geography",
    "U.S. CITIES": "Geography",
    "CAPITALS": "Geography",
    "MUSIC": "Music",
    "ROCK MUSIC": "Music",
    "POP MUSIC": "Music",
    "CLASSICAL MUSIC": "Music",
    "OPERA": "Music",
    "FILM": "Film & TV",
    "MOVIES": "Film & TV",
    "TELEVISION": "Film & TV",
    "TV": "Film & TV",
    "LITERATURE": "Arts & Literature",
    "BOOKS": "Arts & Literature",
    "AUTHORS": "Arts & Literature",
    "POETRY": "Arts & Literature",
    "ART": "Arts & Literature",
    "SPORTS": "Sport & Leisure",
    "BASEBALL": "Sport & Leisure",
    "FOOTBALL": "Sport & Leisure",
    "BASKETBALL": "Sport & Leisure",
    "TENNIS": "Sport & Leisure",
    "FOOD": "Food & Drink",
    "FOOD & DRINK": "Food & Drink",
    "BEVERAGES": "Food & Drink",
    "COOKING": "Food & Drink",
    "RELIGION": "Society & Culture",
    "MYTHOLOGY": "Society & Culture",
    "HOLIDAYS": "Society & Culture",
    "LANGUAGES": "Society & Culture",
    "POTPOURRI": "General Knowledge",
    "GENERAL KNOWLEDGE": "General Knowledge",
    "WORD ORIGINS": "General Knowledge",
    "DEFINITIONS": "General Knowledge",
}


def _map_jeopardy_category(raw_category: str) -> Optional[str]:
    upper = raw_category.upper().strip()
    # Exact match first
    if upper in _JEOPARDY_CATEGORY_MAP:
        return _JEOPARDY_CATEGORY_MAP[upper]
    # Keyword scan
    for key, target in _JEOPARDY_CATEGORY_MAP.items():
        if key in upper:
            return target
    return None


def run_seed(db_path: str, limit: Optional[int] = None) -> None:
    console.rule("[bold blue]Phase: Seed")

    engine = init_db(db_path)

    with Session(engine) as session:
        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "seed")
        ).first()
        if state and state.status == "complete":
            console.print("[green]Seed phase already complete — skipping.")
            return

        if not state:
            state = PipelineState(phase="seed", status="running")
            session.add(state)
            session.commit()
        else:
            state.status = "running"
            session.add(state)
            session.commit()

    console.print("Loading Jeopardy dataset from HuggingFace…")
    try:
        from datasets import load_dataset  # type: ignore

        dataset = load_dataset("jeopardy-datasets/jeopardy", split="train")
    except Exception as exc:
        console.print(f"[red]Failed to load Jeopardy dataset: {exc}")
        raise

    rows = list(dataset)
    if limit:
        rows = rows[:limit]

    loaded = 0
    skipped_category = 0

    with Session(engine) as session:
        existing_ids: set[str] = set(
            session.exec(
                select(Question.text).where(Question.source_type == "seed")
            ).all()
        )

        for row in track(rows, description="Importing seed questions…"):
            raw_cat = row.get("category", "")
            mapped = _map_jeopardy_category(raw_cat)
            if not mapped:
                skipped_category += 1
                continue

            question_text = row.get("question", "").strip()
            answer = row.get("answer", "").strip()
            if not question_text or not answer:
                continue

            # Skip already-loaded rows (idempotent)
            if question_text in existing_ids:
                continue

            # Seed questions have no distractors yet — use placeholder text.
            # The review phase or a future distractor-generation step can fill these.
            q = Question(
                source_type="seed",
                text=question_text,
                correct_answer=answer,
                distractor_1="[distractor pending]",
                distractor_2="[distractor pending]",
                distractor_3="[distractor pending]",
                category=mapped,
                difficulty="medium",  # default; verify phase can refine
                confidence_score=1.0,
                verified=True,  # seed data is trusted
            )
            session.add(q)
            loaded += 1

            if loaded % 1000 == 0:
                session.commit()

        session.commit()

        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "seed")
        ).first()
        state.status = "complete"
        state.items_processed = loaded
        session.add(state)
        session.commit()

    console.print(
        f"[green]Seed complete:[/green] {loaded} questions loaded, "
        f"{skipped_category} skipped (unmapped category)."
    )
