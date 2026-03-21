"""Phase 4: Interactive terminal CLI for reviewing low-confidence questions."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.db import Question, ReviewQueue, SourceChunk, init_db

console = Console()

HELP_TEXT = "[a]pprove  [e]dit  [r]eject  [s]kip  [q]uit"


def _get_key() -> str:
    try:
        import readchar  # type: ignore

        return readchar.readkey().lower()
    except ImportError:
        return input("Action (a/e/r/s/q): ").strip().lower()[:1]


def _display_question(
    entry: ReviewQueue,
    question: Question,
    chunk: SourceChunk | None,
    index: int,
    total: int,
) -> None:
    console.clear()
    header = (
        f"Question {index}/{total} — "
        f"Confidence: {question.confidence_score:.2f} — "
        f"Category: {question.category} — "
        f"Difficulty: {question.difficulty}"
    )
    console.rule(header)

    body = Text()
    body.append("Q: ", style="bold cyan")
    body.append(question.text + "\n")
    body.append("A: ", style="bold green")
    body.append(question.correct_answer + "\n")
    body.append("D: ", style="bold red")
    body.append(
        f"{question.distractor_1}  |  {question.distractor_2}  |  {question.distractor_3}\n"
    )

    if chunk:
        source_preview = chunk.text[:400].replace("\n", " ")
        body.append("\nSource: ", style="bold dim")
        body.append(source_preview + "…\n", style="dim")

    body.append(f"\nReason: {entry.reason}\n", style="yellow")

    console.print(Panel(body, expand=False))
    console.print(f"\n{HELP_TEXT}\n")


def _edit_question(question: Question) -> Question:
    """Open $EDITOR with the question JSON; return updated question on save."""
    data = {
        "text": question.text,
        "correct_answer": question.correct_answer,
        "distractor_1": question.distractor_1,
        "distractor_2": question.distractor_2,
        "distractor_3": question.distractor_3,
        "difficulty": question.difficulty,
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
        question.text = updated.get("text", question.text)
        question.correct_answer = updated.get("correct_answer", question.correct_answer)
        question.distractor_1 = updated.get("distractor_1", question.distractor_1)
        question.distractor_2 = updated.get("distractor_2", question.distractor_2)
        question.distractor_3 = updated.get("distractor_3", question.distractor_3)
        question.difficulty = updated.get("difficulty", question.difficulty)
    except (json.JSONDecodeError, KeyError) as exc:
        console.print(f"[red]Failed to parse edited JSON: {exc} — changes discarded.")
    finally:
        os.unlink(tmp_path)

    return question


def run_review(db_path: str) -> None:
    console.rule("[bold blue]Phase: Review")

    engine = init_db(db_path)

    with Session(engine) as session:
        pending = session.exec(
            select(ReviewQueue)
            .where(ReviewQueue.status == "pending")
            .order_by(ReviewQueue.id)  # lowest confidence entries first (inserted that way)
        ).all()

    if not pending:
        console.print("[green]No questions pending review.")
        return

    total = len(pending)
    console.print(f"{total} questions pending review.\n")

    with Session(engine) as session:
        for index, entry in enumerate(pending, start=1):
            question = session.get(Question, entry.question_id)
            if not question:
                continue

            chunk = (
                session.get(SourceChunk, question.source_chunk_id)
                if question.source_chunk_id
                else None
            )

            _display_question(entry, question, chunk, index, total)

            while True:
                key = _get_key()

                if key == "a":
                    question.verified = True
                    entry.status = "approved"
                    entry.reviewed_at = datetime.utcnow()
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[green]✓ Approved")
                    break

                elif key == "r":
                    question.rejected = True
                    entry.status = "rejected"
                    entry.reviewed_at = datetime.utcnow()
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[red]✗ Rejected")
                    break

                elif key == "e":
                    question = _edit_question(question)
                    question.verified = True
                    entry.status = "approved"
                    entry.reviewed_at = datetime.utcnow()
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[green]✓ Edited and approved")
                    break

                elif key == "s":
                    console.print("[dim]Skipped")
                    break

                elif key == "q":
                    console.print("\n[bold]Review session ended.")
                    return

                else:
                    console.print(f"Unknown key '{key}'. {HELP_TEXT}")

    console.print(f"\n[green]Review complete.[/green] {total} questions processed.")
