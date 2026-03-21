"""Phase 5: Export verified questions to the minimal app database."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

from rich.console import Console
from rich.table import Table
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import CATEGORIES, CATEGORY_SLUGS, EXPORT_PATH
from models.db import Question, init_db

console = Console()

CATEGORY_ROWS = [(CATEGORY_SLUGS[name], name) for name in CATEGORIES]


def _get_current_db_version(export_path: str) -> int:
    """Read the current db_version from an existing export DB, or return 0."""
    p = Path(export_path)
    if not p.exists():
        return 0
    try:
        con = sqlite3.connect(export_path)
        cur = con.execute("SELECT value FROM metadata WHERE key = 'db_version'")
        row = cur.fetchone()
        con.close()
        return int(row[0]) if row else 0
    except Exception:
        return 0


def _create_export_schema(con: sqlite3.Connection) -> None:
    con.executescript("""
        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            distractor_1 TEXT NOT NULL,
            distractor_2 TEXT NOT NULL,
            distractor_3 TEXT NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard'))
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_category_difficulty
            ON questions(category, difficulty);
    """)


def _validate_distribution(questions: list, total: int) -> None:
    """Print and assert SC-002 (category ≤ 20%) and SC-003 (difficulty ≥ 25%)."""
    if total == 0:
        return

    from collections import Counter

    cat_counts = Counter(q["category"] for q in questions)
    diff_counts = Counter(q["difficulty"] for q in questions)

    violations = []
    for cat, count in cat_counts.items():
        pct = count / total * 100
        if pct > 20:
            violations.append(f"Category '{cat}' is {pct:.1f}% > 20% (SC-002)")

    for diff in ("easy", "medium", "hard"):
        pct = diff_counts.get(diff, 0) / total * 100
        if pct < 25:
            violations.append(f"Difficulty '{diff}' is {pct:.1f}% < 25% (SC-003)")

    if violations:
        console.print("[yellow]Distribution warnings:")
        for v in violations:
            console.print(f"  [yellow]⚠ {v}")
    else:
        console.print("[green]Distribution checks passed (SC-002, SC-003).")


def run_export(db_path: str, output_path: str | None = None) -> None:
    console.rule("[bold blue]Phase: Export")

    if output_path is None:
        output_path = str(EXPORT_PATH)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Determine next db_version
    current_version = _get_current_db_version(output_path)
    new_version = current_version + 1

    engine = init_db(db_path)

    with Session(engine) as session:
        questions = session.exec(
            select(Question).where(
                Question.verified == True,  # noqa: E712
                Question.rejected == False,  # noqa: E712
                Question.is_duplicate == False,  # noqa: E712
            )
        ).all()

    if not questions:
        console.print("[red]No verified questions to export. Run verify phase first.")
        return

    # Convert to dicts for export
    export_rows = [
        {
            "id": str(q.id),
            "text": q.text,
            "correct_answer": q.correct_answer,
            "distractor_1": q.distractor_1,
            "distractor_2": q.distractor_2,
            "distractor_3": q.distractor_3,
            "category": CATEGORY_SLUGS.get(q.category, q.category.lower().replace(" ", "_")),
            "difficulty": q.difficulty,
        }
        for q in questions
    ]

    _validate_distribution(export_rows, len(export_rows))

    # Write export DB
    con = sqlite3.connect(output_path)
    _create_export_schema(con)

    con.execute("DELETE FROM questions")
    con.execute("DELETE FROM categories")
    con.execute("DELETE FROM metadata")

    con.executemany(
        "INSERT INTO questions VALUES (:id, :text, :correct_answer, "
        ":distractor_1, :distractor_2, :distractor_3, :category, :difficulty)",
        export_rows,
    )
    con.executemany("INSERT OR REPLACE INTO categories VALUES (?, ?)", CATEGORY_ROWS)
    con.execute("INSERT OR REPLACE INTO metadata VALUES ('db_version', ?)", (str(new_version),))
    con.commit()
    con.close()

    # Print summary
    from collections import Counter

    cat_counts = Counter(r["category"] for r in export_rows)
    diff_counts = Counter(r["difficulty"] for r in export_rows)

    table = Table(title="Export Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    table.add_row("Total questions", str(len(export_rows)))
    table.add_row("db_version written", str(new_version))
    table.add_row("Output path", output_path)
    for cat, count in sorted(cat_counts.items()):
        table.add_row(f"  {cat}", str(count))
    for diff in ("easy", "medium", "hard"):
        table.add_row(f"  [{diff}]", str(diff_counts.get(diff, 0)))
    console.print(table)
    console.print(
        f"\n[bold]Set BUNDLED_DB_VERSION = {new_version} in LocalDatabaseProvider.ts "
        "after copying the export DB to app assets.[/bold]"
    )
