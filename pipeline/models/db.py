"""SQLModel ORM definitions for the generation database."""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, text


class SourceChunk(SQLModel, table=True):
    __tablename__ = "source_chunks"

    id: Optional[int] = Field(default=None, primary_key=True)
    source_type: str  # 'wikipedia' or 'seed'
    source_url: Optional[str] = None
    source_title: Optional[str] = None
    category: str
    text: str
    processed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Question(SQLModel, table=True):
    __tablename__ = "questions"

    id: Optional[int] = Field(default=None, primary_key=True)
    source_chunk_id: Optional[int] = Field(default=None, foreign_key="source_chunks.id")
    source_type: str  # 'generated' or 'seed'
    text: str
    correct_answer: str
    distractor_1: str
    distractor_2: str
    distractor_3: str
    category: str
    difficulty: str  # 'easy' | 'medium' | 'hard'
    confidence_score: Optional[float] = None
    is_duplicate: bool = Field(default=False)
    duplicate_of: Optional[int] = Field(default=None, foreign_key="questions.id")
    grounded: bool = Field(default=True)
    verified: bool = Field(default=False)
    rejected: bool = Field(default=False)
    human_approved: bool = Field(default=False)
    edited: bool = Field(default=False)
    flag_reason: Optional[str] = None
    rejection_source: Optional[str] = None  # 'validator' | 'human'
    # Originals captured at generation time — never updated — for feedback/analysis
    original_text: Optional[str] = None
    original_correct_answer: Optional[str] = None
    original_distractor_1: Optional[str] = None
    original_distractor_2: Optional[str] = None
    original_distractor_3: Optional[str] = None
    original_category: Optional[str] = None
    original_difficulty: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReviewQueue(SQLModel, table=True):
    __tablename__ = "review_queue"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id")
    reason: str  # 'low_confidence' | 'grounding_failed'
    status: str = Field(default="pending")  # 'pending' | 'approved' | 'rejected'
    reviewer_notes: Optional[str] = None
    validator_suggestion_accepted: Optional[bool] = Field(default=None)  # None = no suggestion was made
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None


class DuplicateExemption(SQLModel, table=True):
    __tablename__ = "duplicate_exemptions"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id")
    exempt_from_id: int = Field(foreign_key="questions.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PipelineState(SQLModel, table=True):
    __tablename__ = "pipeline_state"

    id: Optional[int] = Field(default=None, primary_key=True)
    phase: str = Field(unique=True)  # 'seed' | 'generate' | 'verify' | 'review' | 'export'
    status: str = Field(default="pending")  # 'pending' | 'running' | 'complete'
    last_processed_id: Optional[int] = None
    items_processed: int = Field(default=0)
    items_total: Optional[int] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


def init_db(db_path: str) -> "Engine":  # noqa: F821
    """Create all tables and indexes, return the engine."""
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # Migrations: ALTER TABLE ADD COLUMN is idempotent via try/except (SQLite limitation)
        _migrations = [
            "ALTER TABLE questions ADD COLUMN flag_reason TEXT",
            "ALTER TABLE questions ADD COLUMN edited INTEGER DEFAULT 0",
            "ALTER TABLE questions ADD COLUMN original_text TEXT",
            "ALTER TABLE questions ADD COLUMN original_correct_answer TEXT",
            "ALTER TABLE questions ADD COLUMN original_distractor_1 TEXT",
            "ALTER TABLE questions ADD COLUMN original_distractor_2 TEXT",
            "ALTER TABLE questions ADD COLUMN original_distractor_3 TEXT",
            "ALTER TABLE questions ADD COLUMN original_category TEXT",
            "ALTER TABLE questions ADD COLUMN original_difficulty TEXT",
            "ALTER TABLE review_queue ADD COLUMN validator_suggestion_accepted INTEGER",
            "ALTER TABLE questions ADD COLUMN rejection_source TEXT",
        ]
        for migration in _migrations:
            try:
                session.exec(text(migration))
                session.commit()
            except Exception:
                pass  # column already exists


        session.exec(
            text(
                "CREATE INDEX IF NOT EXISTS idx_chunks_category_processed "
                "ON source_chunks(category, processed)"
            )
        )
        session.exec(
            text(
                "CREATE INDEX IF NOT EXISTS idx_questions_export "
                "ON questions(category, difficulty, verified, rejected, is_duplicate)"
            )
        )
        session.exec(
            text(
                "CREATE INDEX IF NOT EXISTS idx_questions_review "
                "ON questions(confidence_score, verified, rejected)"
            )
        )
        session.exec(
            text("CREATE INDEX IF NOT EXISTS idx_review_status ON review_queue(status)")
        )
        session.exec(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup_exemptions "
                "ON duplicate_exemptions(question_id, exempt_from_id)"
            )
        )
        session.commit()

    return engine
