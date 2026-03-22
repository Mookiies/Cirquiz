"""Phase: LLM self-validation of generated questions."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import track
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import MODEL_NAME
from models.db import PipelineState, Question, ReviewQueue, init_db
from models.schemas import QuestionValidation

console = Console()


def _answer_in_question(q: Question) -> bool:
    """Fast pre-check: does the correct answer appear verbatim in the question text?"""
    answer = q.correct_answer.lower().strip()
    question = q.text.lower().strip()
    # Only flag if answer is non-trivial (skip single chars, articles, etc.)
    return len(answer) > 3 and answer in question


def _malformed_question(q: Question) -> str | None:
    """Fast pre-check: return a rejection reason if the question text is obviously malformed."""
    text = (q.text or "").strip()

    # Too short or empty to be a real question
    if len(text) < 10:
        return f"question text too short: {repr(text)}"

    # Must end with a question mark
    if not text.endswith("?"):
        return "question text does not end with '?'"

    # Math/calculation questions — answers must be recalled facts, not computed
    import re
    calc_patterns = [
        r"\bin total\b", r"\bthe sum\b", r"\bhow many .{0,30}\b(total|altogether|combined)\b",
        r"\bwhat is the (total|sum|product|difference|distance|speed|rate|cost|price|value)\b",
        r"\bcalculate\b", r"\bsolve\b", r"\bequals?\b",
        r"\bin (meters?|kilometres?|kilometers?|miles?|kg|pounds?|seconds?|minutes?|hours?)\b",
    ]
    for pattern in calc_patterns:
        if re.search(pattern, text.lower()):
            return f"question appears to require calculation: matched '{pattern}'"

    # Contains embedded options (A), B), 1., 2., etc.)
    if re.search(r"\b[A-Da-d]\)", text) or re.search(r"\b[1-4]\.", text):
        return "question text contains embedded answer options"

    # Temporally relative language — questions must be timeless facts
    temporal_refs = [
        "current", "currently", "today", "now", "at present", "at the moment",
        "recent", "recently", "latest", "modern", "ongoing", "this year",
        "last year", "next year", "this month", "this week", "right now",
    ]
    for ref in temporal_refs:
        if re.search(rf"\b{re.escape(ref)}\b", lower):
            return f"question uses temporally relative language: '{ref}'"

    # References source material or media the player cannot see
    source_refs = [
        "the passage",
        "this passage",
        "in the passage",
        "the text",
        "the article",
        "as mentioned",
        "as described",
        "as stated",
        "listed in",
        "according to",
        "based on the",
        "this image",
        "the image",
        "in this image",
        "this photo",
        "the photo",
        "this picture",
        "the picture",
        "this diagram",
        "the diagram",
        "this map",
        "the map",
        "shown here",
        "pictured here",
        "depicted here",
        "featured in this",
    ]
    lower = text.lower()
    for ref in source_refs:
        if ref in lower:
            return f"question references source material: '{ref}'"

    return None


def _build_validation_prompt(q: Question) -> str:
    return f"""You are a trivia quality reviewer. Evaluate the following multiple-choice trivia question.

Question: {q.text}
Correct Answer: {q.correct_answer}
Wrong Answer 1: {q.distractor_1}
Wrong Answer 2: {q.distractor_2}
Wrong Answer 3: {q.distractor_3}
Current Category: {q.category}
Current Difficulty: {q.difficulty}

Assess:
1. Is the question clear and unambiguous with one definitively correct answer? \
Reject if any of the following are true: \
- The question references "the passage", "the text", "the article", "as mentioned", or similar — \
it must stand alone without source material. \
- The question uses temporally relative language ("current", "currently", "today", "recent", \
"latest", "modern", "ongoing", "now", "this year", etc.) — questions must be timeless facts \
that will remain accurate indefinitely. "Which areas are threatened by the current fire?" \
is invalid because it goes out of date immediately. Reject these. \
- The question references an image, photo, diagram, map, or any visual media the player cannot see \
(e.g. "featured in this image", "shown here", "pictured here", "this photo") — reject these. \
- The question text is not a plain question. It must be a single sentence ending in "?". \
Reject if the question text embeds answer options (e.g. "A) ...", "1.", bullet points, or any list), \
contains multiple sentences, or includes anything other than the question itself.
2. Are all three wrong answers plausible but clearly incorrect?
3. Does the correct answer NOT appear (even partially) in the wrong answers?
4. Does the question text itself reveal or strongly imply the correct answer? \
(e.g. "Who developed Adobe Illustrator?" with answer "Adobe" — the answer is in the question)
5. Are all four answer options the same type and format? \
A question is invalid if the correct answer is structurally distinguishable from the other options by \
its format alone, even without knowing the subject matter. Examples of invalid format mixing: \
(a) the question asks "which countries" but only the correct answer lists multiple countries while the \
others are single countries; \
(b) the correct answer uses "4200 BC" notation while all distractors use "X years ago" notation — \
the odd format immediately identifies the correct answer. \
All options must be interchangeable in type and notation so no option stands out by its form alone.
6. Is the difficulty rating appropriate? Judge as a random adult seeing only this question \
with no passage, image, or topic context. Knowing it's in a passage about Switzerland \
does not make "When is Swiss National Day?" easy — it's hard because most people don't know it. \
Bias toward rating harder rather than easier when uncertain.
7. Is the question fully self-contained? Reject if: \
(a) answering it requires specific values, names, or data that are not in the question itself \
and would only be known from reading a source passage (e.g. distances, counts, or names of \
fictional characters from a word problem); \
(b) the correct answer must be computed or calculated rather than recalled as a known fact; \
(c) the question is a math or word problem — trivia must test memory of real-world facts, \
not arithmetic.
8. Is the category correct?

Return your verdict."""


def run_validate(
    db_path: str,
    model_name: str = MODEL_NAME,
    limit: Optional[int] = None,
) -> None:
    console.rule("[bold blue]Phase: Validate")

    engine = init_db(db_path)

    with Session(engine) as session:
        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "validate")
        ).first()

        last_id = state.last_processed_id if state else None

        if not state:
            state = PipelineState(phase="validate", status="running")
            session.add(state)
            session.commit()
        elif state.status == "complete":
            # Reset to running so new questions (id > last_id) get processed
            state.status = "running"
            session.add(state)
            session.commit()

        # Fetch unvalidated questions: not rejected, not duplicate, id > last checkpoint
        query = select(Question).where(
            Question.rejected == False,  # noqa: E712
            Question.is_duplicate == False,  # noqa: E712
        )
        if last_id:
            query = query.where(Question.id > last_id)
        query = query.order_by(Question.id)

        questions = session.exec(query).all()

    if limit:
        questions = questions[:limit]

    if not questions:
        console.print("[yellow]No questions to validate.")
        return

    console.print(f"Validating {len(questions)} questions via LLM…")

    try:
        import outlines  # type: ignore

        generator = outlines.models.mlxlm(model_name)
        structured = outlines.generate.json(generator, QuestionValidation)
    except ImportError as exc:
        console.print(f"[red]Missing dependency: {exc}. Run: pip install -r requirements.txt")
        raise

    rejected = 0
    flagged = 0
    checkpoint_interval = 10

    with Session(engine) as session:
        for i, q in enumerate(track(questions, description="Validating…")):
            db_q = session.get(Question, q.id)
            if not db_q:
                continue

            # Fast pre-check: malformed question text (saves LLM call)
            malformed_reason = _malformed_question(q)
            if malformed_reason:
                db_q.rejected = True
                db_q.flag_reason = malformed_reason
                rejected += 1
                console.print(f"[red]  reject id={q.id}: {malformed_reason}")
                session.add(db_q)
                continue

            # Fast pre-check: skip LLM call if answer is verbatim in the question
            if _answer_in_question(q):
                db_q.rejected = True
                db_q.flag_reason = f"answer '{q.correct_answer}' appears verbatim in question text"
                rejected += 1
                console.print(
                    f"[red]  reject id={q.id}: correct answer '{q.correct_answer}' "
                    "appears in question text"
                )
                session.add(db_q)
                continue

            prompt = _build_validation_prompt(q)
            try:
                verdict: QuestionValidation = structured(prompt)
            except Exception as exc:
                console.print(f"[yellow]  id={q.id} validation failed: {exc} — skipping")
                continue

            if not verdict.is_valid or verdict.answer_in_question:
                db_q.rejected = True
                reason = verdict.rejection_reason or (
                    "answer revealed in question text"
                    if verdict.answer_in_question
                    else "failed validation"
                )
                db_q.flag_reason = reason
                rejected += 1
                console.print(f"[red]  reject id={q.id}: {reason}")
            else:
                mismatches = []
                if verdict.difficulty != db_q.difficulty:
                    mismatches.append(
                        f"difficulty suggested: '{verdict.difficulty}' (was '{db_q.difficulty}')"
                    )
                if verdict.category != db_q.category:
                    mismatches.append(
                        f"category suggested: '{verdict.category}' (was '{db_q.category}')"
                    )

                if mismatches:
                    db_q.flag_reason = "validate disagrees — " + "; ".join(mismatches)
                    existing = session.exec(
                        select(ReviewQueue).where(ReviewQueue.question_id == q.id)
                    ).first()
                    if not existing:
                        if len(mismatches) > 1:
                            reason = "field_mismatch"
                        elif "difficulty" in mismatches[0]:
                            reason = "difficulty_mismatch"
                        else:
                            reason = "category_mismatch"
                        session.add(ReviewQueue(question_id=q.id, reason=reason))
                    flagged += 1
                    console.print(f"[yellow]  flagged id={q.id}: {db_q.flag_reason}")

            session.add(db_q)

            if (i + 1) % checkpoint_interval == 0:
                state_row = session.exec(
                    select(PipelineState).where(PipelineState.phase == "validate")
                ).first()
                state_row.last_processed_id = q.id
                state_row.items_processed = i + 1
                session.add(state_row)
                session.commit()

        state_row = session.exec(
            select(PipelineState).where(PipelineState.phase == "validate")
        ).first()
        state_row.status = "complete"
        state_row.items_processed = len(questions)
        session.add(state_row)
        session.commit()

    console.print(
        f"[green]Validate complete:[/green] "
        f"{len(questions) - rejected - flagged} passed, {rejected} rejected, "
        f"{flagged} flagged for review (difficulty/category suggestions)."
    )
