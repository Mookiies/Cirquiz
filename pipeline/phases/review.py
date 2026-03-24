"""Phase 4: Interactive terminal CLI for reviewing low-confidence questions."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.db import Question, ReviewQueue, SourceChunk, init_db
from phases._common import CATEGORY_KEYS, CATEGORY_LEGEND, DIFFICULTY_KEYS, edit_question, get_key

console = Console()

HELP_TEXT = (
    "  1-0) category   e/m/h) difficulty   a) approve   y) accept suggestion"
    "   x) edit   r) reject   s) skip   g) google   q) quit"
)


def _display_question(
    entry: ReviewQueue,
    question: Question,
    chunk: SourceChunk | None,
    index: int,
    total: int,
    staged_category: str | None,
    staged_difficulty: str | None,
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

    body.append("\n")
    body.append("Category:   ", style="bold")
    body.append(question.category)
    if staged_category is not None:
        body.append(f"  →  [{staged_category}]", style="bold yellow")
    body.append("\n")

    body.append("Difficulty: ", style="bold")
    body.append(question.difficulty)
    if staged_difficulty is not None:
        body.append(f"  →  [{staged_difficulty}]", style="bold yellow")
    body.append("\n")

    console.print(Panel(body, expand=False))
    console.print(f"\n[dim]{CATEGORY_LEGEND}[/dim]")
    console.print(f"\n[bold]{HELP_TEXT}[/bold]\n")


def _apply_staged(
    question: Question,
    staged_category: str | None,
    staged_difficulty: str | None,
) -> None:
    if staged_category is not None:
        question.category = staged_category
    if staged_difficulty is not None:
        question.difficulty = staged_difficulty



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
            if question.is_duplicate or question.rejected:
                entry.status = "rejected"
                session.add(entry)
                session.commit()
                continue

            chunk = (
                session.get(SourceChunk, question.source_chunk_id)
                if question.source_chunk_id
                else None
            )

            staged_category: str | None = None
            staged_difficulty: str | None = None
            has_validator_suggestion = (
                entry.reason in ("difficulty_mismatch", "category_mismatch", "field_mismatch")
            )
            suggestion_accepted = False  # tracks whether human pressed 'y'

            _display_question(entry, question, chunk, index, total, staged_category, staged_difficulty)

            while True:
                key = get_key()

                if key in CATEGORY_KEYS:
                    staged_category = CATEGORY_KEYS[key]
                    _display_question(entry, question, chunk, index, total, staged_category, staged_difficulty)

                elif key in DIFFICULTY_KEYS:
                    staged_difficulty = DIFFICULTY_KEYS[key]
                    _display_question(entry, question, chunk, index, total, staged_category, staged_difficulty)

                elif key == "a":
                    if staged_category is not None or staged_difficulty is not None:
                        question.edited = True
                    _apply_staged(question, staged_category, staged_difficulty)
                    question.verified = True
                    question.human_approved = True
                    entry.status = "approved"
                    entry.reviewed_at = datetime.utcnow()
                    if has_validator_suggestion:
                        entry.validator_suggestion_accepted = suggestion_accepted
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[green]✓ Approved")
                    break

                elif key == "y":
                    import re

                    if question.flag_reason:
                        diff_match = re.search(
                            r"difficulty suggested: '([^']+)'", question.flag_reason
                        )
                        cat_match = re.search(
                            r"category suggested: '([^']+)'", question.flag_reason
                        )
                        if diff_match and staged_difficulty is None:
                            staged_difficulty = diff_match.group(1)
                        if cat_match and staged_category is None:
                            staged_category = cat_match.group(1)
                    suggestion_accepted = True
                    _display_question(entry, question, chunk, index, total, staged_category, staged_difficulty)

                elif key == "x":
                    question = edit_question(question, staged_category, staged_difficulty)
                    staged_category = None
                    staged_difficulty = None
                    question.verified = True
                    question.human_approved = True
                    entry.status = "approved"
                    entry.reviewed_at = datetime.utcnow()
                    if has_validator_suggestion:
                        entry.validator_suggestion_accepted = suggestion_accepted
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[green]✓ Edited and approved")
                    break

                elif key == "r":
                    question.rejected = True
                    question.rejection_source = "human"
                    entry.status = "rejected"
                    entry.reviewed_at = datetime.utcnow()
                    session.add(question)
                    session.add(entry)
                    session.commit()
                    console.print("[red]✗ Rejected")
                    break

                elif key == "g":
                    import subprocess
                    import urllib.parse
                    url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(question.text)
                    subprocess.run(["open", url], check=False)

                elif key == "s":
                    console.print("[dim]Skipped")
                    break

                elif key == "q":
                    console.print("\n[bold]Review session ended.")
                    return

                else:
                    console.print(f"[yellow]Unknown key '{key}'.[/yellow] [bold]{HELP_TEXT}[/bold]")

    console.print(f"\n[green]Review complete.[/green] {total} questions processed.")
