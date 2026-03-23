"""Interactive review of flagged duplicate questions."""

from __future__ import annotations

import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.db import DuplicateExemption, Question, init_db
from phases._common import get_key

console = Console()

HELP_TEXT = "  [k]eep duplicate   [n]ot a duplicate   [s]kip   [q]uit"


def _display_pair(dup: Question, canonical: Question, index: int, total: int) -> None:
    console.clear()
    console.rule(f"[bold blue]Duplicate Review {index}/{total}")

    body = Text()
    body.append("FLAGGED (duplicate):\n", style="bold red")
    body.append(f"  id={dup.id}  Q: ", style="dim")
    body.append(dup.text + "\n")
    body.append(f"  A: ", style="bold green")
    body.append(dup.correct_answer + "\n")

    body.append("\nCANONICAL:\n", style="bold cyan")
    body.append(f"  id={canonical.id}  Q: ", style="dim")
    body.append(canonical.text + "\n")
    body.append(f"  A: ", style="bold green")
    body.append(canonical.correct_answer + "\n")

    console.print(Panel(body, expand=False))
    console.print(f"\n[bold]{HELP_TEXT}[/bold]\n")


def run_dupes(db_path: str) -> None:
    console.rule("[bold blue]Phase: Duplicate Review")

    engine = init_db(db_path)

    with Session(engine) as session:
        duplicates = session.exec(
            select(Question).where(
                Question.is_duplicate == True,  # noqa: E712
                Question.rejected == False,  # noqa: E712
            )
        ).all()

    if not duplicates:
        console.print("[green]No flagged duplicates to review.")
        return

    total = len(duplicates)
    console.print(f"{total} flagged duplicates to review.\n")

    kept = 0
    unmarked = 0
    skipped = 0

    with Session(engine) as session:
        existing_exemptions: set[frozenset[int]] = {
            frozenset({r.question_id, r.exempt_from_id})
            for r in session.exec(select(DuplicateExemption)).all()
        }

        for index, dup in enumerate(duplicates, start=1):
            dup = session.get(Question, dup.id)
            if not dup or not dup.is_duplicate:
                continue

            canonical = session.get(Question, dup.duplicate_of)
            if not canonical:
                skipped += 1
                continue

            # Already exempted (verify re-flagged a previously cleared pair)
            if frozenset({dup.id, canonical.id}) in existing_exemptions:
                dup.is_duplicate = False
                dup.duplicate_of = None
                session.add(dup)
                session.commit()
                skipped += 1
                continue

            _display_pair(dup, canonical, index, total)

            while True:
                key = get_key()

                if key == "k":
                    kept += 1
                    console.print("[dim]Kept as duplicate")
                    break

                elif key == "n":
                    pair = frozenset({dup.id, canonical.id})
                    if pair not in existing_exemptions:
                        session.add(DuplicateExemption(
                            question_id=dup.id,
                            exempt_from_id=canonical.id,
                        ))
                        existing_exemptions.add(pair)
                    dup.is_duplicate = False
                    dup.duplicate_of = None
                    session.add(dup)
                    session.commit()
                    unmarked += 1
                    console.print("[green]Exemption saved — question unmarked as duplicate")
                    break

                elif key == "s":
                    skipped += 1
                    console.print("[dim]Skipped")
                    break

                elif key == "q":
                    console.print("\n[bold]Duplicate review session ended.")
                    console.print(
                        f"[green]Summary:[/green] {kept} kept, {unmarked} unmarked, {skipped} skipped"
                    )
                    return

                else:
                    console.print(f"[yellow]Unknown key '{key}'.[/yellow] [bold]{HELP_TEXT}[/bold]")

    console.print(
        f"\n[green]Duplicate review complete.[/green] "
        f"{kept} kept, {unmarked} unmarked, {skipped} skipped."
    )
