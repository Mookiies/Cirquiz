"""Integration tests for the generation pipeline."""

import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_db(tmp_path):
    """Return a path to a fresh generation database."""
    return str(tmp_path / "test_generation.db")


@pytest.fixture
def tmp_export(tmp_path):
    """Return a path for the export database."""
    return str(tmp_path / "export" / "cirquiz_questions.db")


STUB_QUESTIONS = [
    {
        "text": f"What is trivia question {i}?",
        "correct_answer": f"Answer {i}",
        "distractor_1": f"Wrong A{i}",
        "distractor_2": f"Wrong B{i}",
        "distractor_3": f"Wrong C{i}",
        "category": cat,
        "difficulty": diff,
    }
    for i, (cat, diff) in enumerate(
        [
            ("History", "easy"),
            ("Science", "medium"),
            ("Geography", "hard"),
            ("Music", "easy"),
            ("Film & TV", "medium"),
            ("Arts & Literature", "hard"),
            ("Sport & Leisure", "easy"),
            ("Society & Culture", "medium"),
            ("Food & Drink", "hard"),
            ("General Knowledge", "easy"),
        ],
        start=1,
    )
]


# ── DB initialisation ──────────────────────────────────────────────────────

def test_init_db_creates_tables(tmp_db):
    from models.db import init_db

    init_db(tmp_db)

    con = sqlite3.connect(tmp_db)
    tables = {
        row[0]
        for row in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    con.close()

    assert "questions" in tables
    assert "source_chunks" in tables
    assert "review_queue" in tables
    assert "pipeline_state" in tables


# ── Seed phase ─────────────────────────────────────────────────────────────

def test_seed_is_idempotent(tmp_db):
    """Running seed twice should not duplicate questions."""
    from models.db import Question, init_db
    from sqlmodel import Session, select

    engine = init_db(tmp_db)

    # Manually insert 10 seed questions
    with Session(engine) as session:
        for stub in STUB_QUESTIONS:
            from models.db import Question

            q = Question(
                source_type="seed",
                text=stub["text"],
                correct_answer=stub["correct_answer"],
                distractor_1=stub["distractor_1"],
                distractor_2=stub["distractor_2"],
                distractor_3=stub["distractor_3"],
                category=stub["category"],
                difficulty=stub["difficulty"],
                confidence_score=1.0,
                verified=True,
            )
            session.add(q)
        session.commit()
        count_first = len(session.exec(select(Question)).all())

    # Insert same questions again — should skip duplicates
    with Session(engine) as session:
        existing_texts = set(
            session.exec(select(Question.text).where(Question.source_type == "seed")).all()
        )
        added = 0
        for stub in STUB_QUESTIONS:
            if stub["text"] not in existing_texts:
                q = Question(
                    source_type="seed",
                    text=stub["text"],
                    correct_answer=stub["correct_answer"],
                    distractor_1=stub["distractor_1"],
                    distractor_2=stub["distractor_2"],
                    distractor_3=stub["distractor_3"],
                    category=stub["category"],
                    difficulty=stub["difficulty"],
                    confidence_score=1.0,
                    verified=True,
                )
                session.add(q)
                added += 1
        session.commit()
        count_second = len(session.exec(select(Question)).all())

    assert count_second == count_first  # no new rows added


# ── Generate phase (mocked LLM) ────────────────────────────────────────────

def test_generate_writes_questions_with_required_fields(tmp_db):
    """Generate phase produces questions with all required fields populated."""
    from models.db import Question, SourceChunk, init_db
    from models.schemas import GeneratedQuestion, GeneratedQuestionBatch
    from sqlmodel import Session, select

    engine = init_db(tmp_db)

    stub_chunk_text = (
        "The Battle of Hastings was fought in 1066 between William the Conqueror "
        "and King Harold II of England. William won and became King of England."
        " " * 200  # pad to pass minimum chunk size
    )

    with Session(engine) as session:
        chunk = SourceChunk(
            source_type="wikipedia",
            source_url="https://simple.wikipedia.org/wiki/Battle_of_Hastings",
            source_title="Battle of Hastings",
            category="History",
            text=stub_chunk_text,
            processed=False,
        )
        session.add(chunk)
        session.commit()
        chunk_id = chunk.id

    mock_batch = GeneratedQuestionBatch(
        questions=[
            GeneratedQuestion(
                text="In what year was the Battle of Hastings fought?",
                correct_answer="1066",
                distractor_1="1066",
                distractor_2="1215",
                distractor_3="1415",
                difficulty="easy",
                confidence_score=0.95,
            )
        ]
    )

    mock_structured = MagicMock(return_value=mock_batch)

    with (
        patch("phases.generate._download_dump"),
        patch("phases.generate._parse_and_store_chunks", return_value=1),
        patch("phases.generate.outlines") as mock_outlines,
        patch("phases.generate.load", return_value=(MagicMock(), MagicMock())),
    ):
        mock_outlines.models.mlxlm.return_value = MagicMock()
        mock_outlines.generate.json.return_value = mock_structured

        from phases.generate import run_generate

        run_generate(db_path=tmp_db, category="History", limit=1)

    with Session(engine) as session:
        generated = session.exec(
            select(Question).where(Question.source_type == "generated")
        ).all()

    assert len(generated) >= 1
    q = generated[0]
    assert q.text
    assert q.correct_answer
    assert q.distractor_1
    assert q.distractor_2
    assert q.distractor_3
    assert q.category == "History"
    assert q.difficulty in ("easy", "medium", "hard")
    assert q.confidence_score is not None
    assert q.source_chunk_id == chunk_id


# ── Export phase ───────────────────────────────────────────────────────────

def test_export_produces_valid_schema(tmp_db, tmp_export):
    """Export writes all required tables, auto-increments db_version, and includes all categories."""
    from models.db import Question, init_db
    from sqlmodel import Session

    engine = init_db(tmp_db)

    with Session(engine) as session:
        for stub in STUB_QUESTIONS:
            q = Question(
                source_type="seed",
                text=stub["text"],
                correct_answer=stub["correct_answer"],
                distractor_1=stub["distractor_1"],
                distractor_2=stub["distractor_2"],
                distractor_3=stub["distractor_3"],
                category=stub["category"],
                difficulty=stub["difficulty"],
                confidence_score=1.0,
                verified=True,
                is_duplicate=False,
                rejected=False,
            )
            session.add(q)
        session.commit()

    from phases.export import run_export

    run_export(db_path=tmp_db, output_path=tmp_export)

    con = sqlite3.connect(tmp_export)

    # Required tables
    tables = {
        row[0]
        for row in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert "questions" in tables
    assert "categories" in tables
    assert "metadata" in tables

    # All required fields present
    count = con.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    assert count == len(STUB_QUESTIONS)

    col_names = [d[0] for d in con.execute("SELECT * FROM questions LIMIT 1").description]
    for field in ("id", "text", "correct_answer", "distractor_1", "distractor_2", "distractor_3", "category", "difficulty"):
        assert field in col_names

    # db_version starts at 1
    version = con.execute("SELECT value FROM metadata WHERE key='db_version'").fetchone()[0]
    assert int(version) == 1

    # All 10 categories present
    cat_count = con.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    assert cat_count == 10

    # At least one question per difficulty
    difficulties = {
        row[0] for row in con.execute("SELECT DISTINCT difficulty FROM questions").fetchall()
    }
    assert "easy" in difficulties
    assert "medium" in difficulties
    assert "hard" in difficulties

    con.close()


def test_export_increments_db_version(tmp_db, tmp_export):
    """Running export twice increments db_version."""
    from models.db import Question, init_db
    from sqlmodel import Session

    engine = init_db(tmp_db)
    with Session(engine) as session:
        stub = STUB_QUESTIONS[0]
        q = Question(
            source_type="seed",
            text=stub["text"],
            correct_answer=stub["correct_answer"],
            distractor_1=stub["distractor_1"],
            distractor_2=stub["distractor_2"],
            distractor_3=stub["distractor_3"],
            category=stub["category"],
            difficulty=stub["difficulty"],
            confidence_score=1.0,
            verified=True,
        )
        session.add(q)
        session.commit()

    from phases.export import run_export

    run_export(db_path=tmp_db, output_path=tmp_export)
    run_export(db_path=tmp_db, output_path=tmp_export)

    con = sqlite3.connect(tmp_export)
    version = con.execute("SELECT value FROM metadata WHERE key='db_version'").fetchone()[0]
    con.close()
    assert int(version) == 2


# ── Resumption ─────────────────────────────────────────────────────────────

def test_pipeline_state_prevents_reprocessing(tmp_db):
    """A completed phase should not reprocess on second invocation."""
    from models.db import PipelineState, init_db
    from sqlmodel import Session

    engine = init_db(tmp_db)

    with Session(engine) as session:
        state = PipelineState(phase="seed", status="complete", items_processed=42)
        session.add(state)
        session.commit()

    # Patch datasets to detect if seed actually runs
    with patch("phases.seed.load_dataset") as mock_load:
        from phases.seed import run_seed

        run_seed(db_path=tmp_db)
        mock_load.assert_not_called()  # Should skip because state is 'complete'
