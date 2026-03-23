"""Phase: Curate — human sweep of all unreviewed valid questions."""

from __future__ import annotations

import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.db import Question, init_db
from phases._common import CATEGORY_KEYS, CATEGORY_LEGEND, DIFFICULTY_KEYS, edit_question, get_key

console = Console()

HELP_TEXT = (
    "  1-0) category   e/m/h) difficulty   a) approve   x) edit   r) reject   s) skip   g) google   q) quit"
)


def _display_question(
    question: Question,
    index: int,
    total: int,
    staged_category: str | None,
    staged_difficulty: str | None,
) -> None:
    console.clear()
    confidence = f"{question.confidence_score:.2f}" if question.confidence_score is not None else "n/a"
    header = f"Question {index}/{total}  id={question.id}  Confidence: {confidence}"
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


def run_curate(db_path: str) -> None:
    console.rule("[bold blue]Phase: Curate")

    engine = init_db(db_path)

    with Session(engine) as session:
        questions = session.exec(
            select(Question).where(
                Question.human_approved == False,  # noqa: E712
                Question.rejected == False,  # noqa: E712
                Question.verified == True,  # noqa: E712
                Question.is_duplicate == False,  # noqa: E712
            ).order_by(Question.id)
        ).all()

    if not questions:
        console.print("[green]No questions pending curation.")
        return

    total = len(questions)
    console.print(f"{total} questions to curate.\n")

    approved = rejected = skipped = 0

    with Session(engine) as session:
        for index, q in enumerate(questions, start=1):
            question = session.get(Question, q.id)
            if not question:
                continue

            staged_category: str | None = None
            staged_difficulty: str | None = None

            _display_question(question, index, total, staged_category, staged_difficulty)

            while True:
                key = get_key()

                if key in CATEGORY_KEYS:
                    staged_category = CATEGORY_KEYS[key]
                    _display_question(question, index, total, staged_category, staged_difficulty)

                elif key in DIFFICULTY_KEYS:
                    staged_difficulty = DIFFICULTY_KEYS[key]
                    _display_question(question, index, total, staged_category, staged_difficulty)

                elif key == "a":
                    if staged_category is not None:
                        question.category = staged_category
                        question.edited = True
                    if staged_difficulty is not None:
                        question.difficulty = staged_difficulty
                        question.edited = True
                    question.human_approved = True
                    session.add(question)
                    session.commit()
                    console.print("[green]✓ Approved")
                    approved += 1
                    break

                elif key == "x":
                    question = edit_question(question, staged_category, staged_difficulty)
                    staged_category = None
                    staged_difficulty = None
                    question.human_approved = True
                    session.add(question)
                    session.commit()
                    console.print("[green]✓ Edited and approved")
                    approved += 1
                    break

                elif key == "r":
                    question.rejected = True
                    question.rejection_source = "human"
                    session.add(question)
                    session.commit()
                    console.print("[red]✗ Rejected")
                    rejected += 1
                    break

                elif key == "g":
                    import subprocess
                    import urllib.parse
                    url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(question.text)
                    subprocess.run(["open", url], check=False)

                elif key == "s":
                    console.print("[dim]Skipped")
                    skipped += 1
                    break

                elif key == "q":
                    console.print("\n[bold]Curation session ended.")
                    console.print(
                        f"  approved={approved}  rejected={rejected}  skipped={skipped}"
                    )
                    return

                else:
                    console.print(
                        f"[yellow]Unknown key '{key}'.[/yellow] [bold]{HELP_TEXT}[/bold]"
                    )

    console.print(
        f"\n[green]Curation complete.[/green] "
        f"approved={approved}  rejected={rejected}  skipped={skipped}"
    )
