"""Shared constants and utilities for review/curate phases."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

CATEGORY_KEYS: dict[str, str] = {
    "1": "arts_and_literature",
    "2": "film_and_tv",
    "3": "general_knowledge",
    "4": "geography",
    "5": "history",
    "6": "music",
    "7": "science",
    "8": "sport_and_leisure",
    "9": "society_and_culture",
    "0": "food_and_drink",
}

DIFFICULTY_KEYS: dict[str, str] = {
    "e": "easy",
    "m": "medium",
    "h": "hard",
}

CATEGORY_LEGEND = (
    "  1=arts_and_literature  2=film_and_tv  3=general_knowledge  4=geography  5=history\n"
    "  6=music  7=science  8=sport_and_leisure  9=society_and_culture  0=food_and_drink"
)


def edit_question(
    question: "Question",  # noqa: F821
    staged_category: str | None = None,
    staged_difficulty: str | None = None,
) -> "Question":  # noqa: F821
    """Open $EDITOR with the question JSON; return updated question on save."""
    data = {
        "text": question.text,
        "correct_answer": question.correct_answer,
        "distractor_1": question.distractor_1,
        "distractor_2": question.distractor_2,
        "distractor_3": question.distractor_3,
        "category": staged_category or question.category,
        "difficulty": staged_difficulty or question.difficulty,
    }
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(data, f, indent=2)
        tmp_path = f.name

    editor = os.environ.get("EDITOR", "nano")
    subprocess.call([editor, tmp_path])

    try:
        with open(tmp_path, encoding="utf-8") as f:
            updated = json.load(f)
        before = (
            question.text, question.correct_answer,
            question.distractor_1, question.distractor_2, question.distractor_3,
            question.category, question.difficulty,
        )
        question.text = updated.get("text", question.text)
        question.correct_answer = updated.get("correct_answer", question.correct_answer)
        question.distractor_1 = updated.get("distractor_1", question.distractor_1)
        question.distractor_2 = updated.get("distractor_2", question.distractor_2)
        question.distractor_3 = updated.get("distractor_3", question.distractor_3)
        question.category = updated.get("category", question.category)
        question.difficulty = updated.get("difficulty", question.difficulty)
        after = (
            question.text, question.correct_answer,
            question.distractor_1, question.distractor_2, question.distractor_3,
            question.category, question.difficulty,
        )
        if before != after:
            question.edited = True
    except (json.JSONDecodeError, KeyError) as exc:
        from rich.console import Console
        Console().print(f"[red]Failed to parse edited JSON: {exc} — changes discarded.")
    finally:
        os.unlink(tmp_path)

    return question


def get_key() -> str:
    try:
        import readchar  # type: ignore

        return readchar.readkey().lower()
    except ImportError:
        return input("Action: ").strip().lower()[:1]
