"""Phase 3: Semantic deduplication and confidence scoring."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
from rich.console import Console
from rich.progress import track
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import CONFIDENCE_THRESHOLD, DEDUP_THRESHOLD
from models.db import DuplicateExemption, PipelineState, Question, ReviewQueue, init_db

console = Console()


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def _run_dedup(session: Session, questions: list[Question]) -> int:
    """Embed all questions and flag near-duplicates. Returns count of duplicates found."""
    console.print("Loading sentence-transformers model for deduplication…")
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError:
        console.print("[red]sentence-transformers not installed. Run: pip install sentence-transformers")
        raise

    model = SentenceTransformer("all-MiniLM-L6-v2")

    rows = session.exec(select(DuplicateExemption)).all()
    exemptions: set[frozenset[int]] = {
        frozenset({r.question_id, r.exempt_from_id}) for r in rows
    }

    texts = [q.text for q in questions]
    console.print(f"Embedding {len(texts)} questions…")
    embeddings = model.encode(texts, batch_size=64, show_progress_bar=True)

    duplicates_found = 0
    for i, q_i in enumerate(questions):
        if q_i.is_duplicate:
            continue
        for j in range(i + 1, len(questions)):
            q_j = questions[j]
            if q_j.is_duplicate:
                continue
            sim = _cosine_similarity(embeddings[i], embeddings[j])
            if sim >= DEDUP_THRESHOLD and frozenset({q_i.id, q_j.id}) not in exemptions:
                # Keep the one with higher confidence; mark the other as duplicate
                if (q_i.confidence_score or 0.0) >= (q_j.confidence_score or 0.0):
                    canonical_id = q_i.id
                    dup_id = q_j.id
                else:
                    canonical_id = q_j.id
                    dup_id = q_i.id

                db_dup = session.get(Question, dup_id)
                if db_dup and not db_dup.is_duplicate:
                    db_dup.is_duplicate = True
                    db_dup.duplicate_of = canonical_id
                    session.add(db_dup)
                    duplicates_found += 1

    session.commit()
    return duplicates_found


def _run_confidence_scoring(
    session: Session,
    questions: list[Question],
    threshold: float,
) -> tuple[int, int]:
    """
    For generated questions:
    - Grounding check: penalise if correct_answer not in source chunk text.
    - Auto-approve if confidence_score >= threshold.
    - Queue remainder for human review.

    Returns (auto_approved, queued_for_review).
    """
    auto_approved = 0
    queued = 0

    for q in track(questions, description="Scoring confidence…"):

        if q.is_duplicate or q.verified or q.rejected:
            continue

        score = q.confidence_score or 0.0

        # Grounding check: penalise if answer substring not in source text
        if q.source_chunk_id:
            from models.db import SourceChunk

            chunk = session.get(SourceChunk, q.source_chunk_id)
            if chunk and q.correct_answer.lower() not in chunk.text.lower():
                q.grounded = False
                score = max(0.0, score - 0.3)  # penalise
                q.confidence_score = score

        if score >= threshold:
            q.verified = True
            session.add(q)
            auto_approved += 1
        else:
            # Add to review queue if not already there
            existing = session.exec(
                select(ReviewQueue).where(ReviewQueue.question_id == q.id)
            ).first()
            if not existing:
                entry = ReviewQueue(
                    question_id=q.id,
                    reason="low_confidence" if q.grounded else "grounding_failed",
                    status="pending",
                    created_at=datetime.utcnow(),
                )
                session.add(entry)
            queued += 1

    session.commit()
    return auto_approved, queued


def run_verify(db_path: str, threshold: Optional[float] = None) -> None:
    console.rule("[bold blue]Phase: Verify")

    if threshold is None:
        threshold = CONFIDENCE_THRESHOLD

    engine = init_db(db_path)

    with Session(engine) as session:
        validate_state = session.exec(
            select(PipelineState).where(PipelineState.phase == "validate")
        ).first()
        last_validated_id = validate_state.last_processed_id if validate_state else None
        unvalidated_query = select(Question).where(
            Question.source_type != "seed",
            Question.rejected == False,  # noqa: E712
        )
        if last_validated_id is not None:
            unvalidated_query = unvalidated_query.where(Question.id > last_validated_id)
        unvalidated_count = len(session.exec(unvalidated_query).all())

        if unvalidated_count > 0:
            console.print(
                f"[bold yellow]Warning:[/bold yellow] {unvalidated_count} generated question(s) "
                "have not been through validate yet."
            )
            answer = input("Continue anyway? [y/N] ").strip().lower()
            if answer != "y":
                console.print("Aborted.")
                return

    with Session(engine) as session:
        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "verify")
        ).first()
        if not state:
            state = PipelineState(phase="verify", status="running")
            session.add(state)
            session.commit()
        elif state.status == "complete":
            state.status = "running"
            session.add(state)
            session.commit()

        # Fetch all non-rejected questions for dedup
        all_questions = session.exec(
            select(Question).where(Question.rejected == False)  # noqa: E712
        ).all()

        console.print(f"Running deduplication on {len(all_questions)} questions…")
        dup_count = _run_dedup(session, list(all_questions))
        console.print(f"[yellow]{dup_count} duplicates flagged.")

        # Re-fetch for confidence scoring (excludes newly marked duplicates)
        scoreable = session.exec(
            select(Question).where(
                Question.is_duplicate == False,  # noqa: E712
                Question.rejected == False,  # noqa: E712
                Question.verified == False,  # noqa: E712
            )
        ).all()

        console.print(f"Running confidence scoring on {len(scoreable)} questions…")
        approved, queued = _run_confidence_scoring(session, list(scoreable), threshold)

        state.status = "complete"
        state.items_processed = len(all_questions)
        session.add(state)
        session.commit()

    console.print(
        f"[green]Verify complete:[/green] {approved} auto-approved, "
        f"{queued} queued for review, {dup_count} duplicates removed."
    )
