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

HELP_TEXT = "  a) approve    y) accept suggestion    e) edit    r) reject    s) skip    q) quit"


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
        f"Question {index}/{total} (id={question.id}) — "
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
        body.append("\nSource: ", style="bold dim")
        body.append(chunk.text.replace("\n", " ") + "\n", style="dim")

    body.append(f"\nReason: {entry.reason}\n", style="yellow")
    if question.flag_reason:
        body.append(f"Flag: {question.flag_reason}\n", style="bold yellow")

    console.print(Panel(body, expand=False))
    console.print(f"\n[bold]{HELP_TEXT}[/bold]\n")


def _edit_question(question: Question) -> Question:
    """Open $EDITOR with the question JSON; return updated question on save."""
    data = {
        "text": question.text,
        "correct_answer": question.correct_answer,
        "distractor_1": question.distractor_1,
        "distractor_2": question.distractor_2,
        "distractor_3": question.distractor_3,
        "category": question.category,
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
        question.category = updated.get("category", question.category)
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

                elif key == "y":
                    import re
                    applied = []
                    if question.flag_reason:
                        diff_match = re.search(
                            r"difficulty suggested: '([^']+)'", question.flag_reason
                        )
                        cat_match = re.search(
                            r"category suggested: '([^']+)'", question.flag_reason
                        )
                        if diff_match:
                            old = question.difficulty
                            question.difficulty = diff_match.group(1)
                            applied.append(f"difficulty {old} → {question.difficulty}")
                        if cat_match:
                            old = question.category
                            question.category = cat_match.group(1)
                            applied.append(f"category {old} → {question.category}")
                        if applied:
                            console.print(f"[cyan]  {', '.join(applied)}")
                        else:
                            console.print("[yellow]  no suggestion found in flag reason")
                    question.verified = True
                    entry.status = "approved"
                    entry.reviewed_at = datetime.utcnow()
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[green]✓ Approved with suggestion")
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
                    console.print(f"[yellow]Unknown key '{key}'.[/yellow] [bold]{HELP_TEXT}[/bold]")

    console.print(f"\n[green]Review complete.[/green] {total} questions processed.")
