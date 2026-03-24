"""Interactive review of flagged duplicate questions."""

from __future__ import annotations

import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.db import DuplicateExemption, PipelineState, Question, init_db
from phases._common import get_key

console = Console()

HELP_TEXT = "  \[y]es, it's a duplicate (remove it)   \[n]o, it's not a duplicate (keep both)   \[f]lip (keep flagged, reject canonical)   \[r]eject both   \[s]kip   \[q]uit"


def _display_pair(dup: Question, canonical: Question, index: int, total: int) -> None:
    console.clear()
    console.rule(f"[bold blue]Duplicate Review {index}/{total}")

    dup_approved = " ✓ human approved" if dup.human_approved else ""
    canonical_approved = " ✓ human approved" if canonical.human_approved else ""

    body = Text()
    body.append(f"FLAGGED (duplicate){dup_approved}:\n", style="bold red")
    body.append(f"  id={dup.id}  Q: ", style="dim")
    body.append(dup.text + "\n")
    body.append(f"  A: ", style="bold green")
    body.append(dup.correct_answer + "\n")

    body.append(f"\nCANONICAL{canonical_approved}:\n", style="bold cyan")
    body.append(f"  id={canonical.id}  Q: ", style="dim")
    body.append(canonical.text + "\n")
    body.append(f"  A: ", style="bold green")
    body.append(canonical.correct_answer + "\n")

    console.print(Panel(body, expand=False))
    console.print(f"\n[bold]{HELP_TEXT}[/bold]\n")


def _save_progress(session: Session, question_id: int) -> None:
    state = session.exec(
        select(PipelineState).where(PipelineState.phase == "dupes")
    ).first()
    if state:
        state.last_processed_id = question_id
        session.add(state)
        session.commit()


def _mark_complete(session: Session) -> None:
    state = session.exec(
        select(PipelineState).where(PipelineState.phase == "dupes")
    ).first()
    if state:
        state.status = "complete"
        session.add(state)
        session.commit()


def run_dupes(db_path: str) -> None:
    console.rule("[bold blue]Phase: Duplicate Review")

    engine = init_db(db_path)

    with Session(engine) as session:
        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "dupes")
        ).first()
        if not state:
            state = PipelineState(phase="dupes", status="running")
            session.add(state)
            session.commit()
        elif state.status == "complete":
            state.status = "running"
            state.last_processed_id = None
            session.add(state)
            session.commit()

        last_id = state.last_processed_id

        query = select(Question).where(
            Question.is_duplicate == True,  # noqa: E712
            Question.rejected == False,  # noqa: E712
        ).order_by(Question.id)
        if last_id:
            query = query.where(Question.id > last_id)
        duplicates = session.exec(query).all()

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

            # Already exempted (verify re-flagged a previously cleared pair) — auto-clear silently
            if frozenset({dup.id, canonical.id}) in existing_exemptions:
                dup.is_duplicate = False
                dup.duplicate_of = None
                session.add(dup)
                session.commit()
                continue

            _display_pair(dup, canonical, index, total)

            while True:
                key = get_key()

                if key == "y":
                    dup.rejected = True
                    dup.rejection_source = "human"
                    session.add(dup)
                    session.commit()
                    kept += 1
                    _save_progress(session, dup.id)
                    console.print("[dim]Confirmed as duplicate — rejected")
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
                    _save_progress(session, dup.id)
                    unmarked += 1
                    console.print("[green]Exemption saved — question unmarked as duplicate")
                    break

                elif key == "f":
                    canonical.rejected = True
                    canonical.rejection_source = "human"
                    dup.is_duplicate = False
                    dup.duplicate_of = None
                    session.add(canonical)
                    session.add(dup)
                    session.commit()
                    _save_progress(session, dup.id)
                    kept += 1
                    console.print("[green]Flagged question kept — canonical rejected")
                    break

                elif key == "r":
                    for q in (dup, canonical):
                        q.rejected = True
                        q.rejection_source = "human"
                        q.is_duplicate = False
                        q.duplicate_of = None
                        session.add(q)
                    session.commit()
                    _save_progress(session, dup.id)
                    kept += 1
                    console.print("[red]Both questions rejected")
                    break

                elif key == "s":
                    _save_progress(session, dup.id)
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

    with Session(engine) as session:
        _mark_complete(session)

    console.print(
        f"\n[green]Duplicate review complete.[/green] "
        f"{kept} kept, {unmarked} unmarked, {skipped} skipped."
    )
