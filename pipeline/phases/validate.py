"""Phase: LLM self-validation of generated questions."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import track
from sqlmodel import Session, func, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import MODEL_NAME
from models.db import PipelineState, Question, ReviewQueue, init_db
from models.schemas import QuestionValidation
from phases.feedback import build_feedback_retriever

console = Console()

# Matches markup or encoding artifacts that leak from Wikipedia source parsing.
_MARKUP_RE = re.compile(
    r":[a-z]+:[A-Za-z_{]"  # RST role syntax: :math:Phi, :ref:target
    r"|%[0-9A-Fa-f]{2}"  # Percent-encoded characters: %26, %3A
    r"|&[a-zA-Z]{2,};"  # HTML named entities: &tau;, &amp;
    r"|&#[0-9]{1,5};"  # HTML numeric entities: &#960;
    r"|\[\[|\]\]"  # MediaWiki link syntax: [[...]]
    r"|\{\{|\}\}"  # MediaWiki template syntax: {{...}}
    r'|"/>'  # XML/HTML self-closing tag fragment: "/>
    r'|">'  # HTML attribute close fragment: ">
)

_MAX_ANSWER_LENGTH = 60


_STOP_WORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "and", "or",
    "but", "that", "this", "it", "its", "which", "who", "what", "where",
    "when", "how", "did", "do", "does", "had", "has", "have", "he", "she",
    "they", "we", "you", "i", "my", "his", "her", "their", "our", "your",
    "as", "if", "so", "not", "no", "nor", "yet", "both", "either", "neither",
    "each", "than", "then", "into", "onto", "about", "above", "after",
    "before", "between", "during", "through", "under", "over", "up", "down",
    "out", "off", "again", "once",
})


def _significant_words(text: str) -> set[str]:
    return {
        w.strip("'\".,!?;:()[]{}") for w in text.lower().split()
        if w not in _STOP_WORDS and len(w) > 2
    }


def _answer_in_question(q: Question) -> bool:
    """Pre-check: is the correct answer revealed by the question text?

    Catches verbatim matches and word-overlap leakage, e.g.:
    "Which event marks the beginning of World War I?" / "World War I begins"
    → 'world' and 'war' from the answer both appear in the question (67% overlap → flagged).
    """
    answer = q.correct_answer.lower().strip()
    question = q.text.lower().strip()

    if len(answer) <= 3:
        return False

    # Full answer appears verbatim in question
    if answer in question:
        return True

    # Significant word overlap: if ≥60% of the answer's meaningful words appear in
    # the question, the answer is substantially leaked by the question text.
    ans_words = _significant_words(answer)
    if len(ans_words) >= 2:
        q_words = _significant_words(question)
        overlap = ans_words & q_words
        if len(overlap) / len(ans_words) >= 0.5:
            return True

    return False


def _malformed_question(q: Question) -> str | None:
    """Fast pre-check: return a rejection reason if the question text is obviously malformed."""
    text = (q.text or "").strip()
    lower = text.lower()

    # Too short or empty to be a real question
    if len(text) < 10:
        return f"question text too short: {repr(text)}"

    # Too long — overly verbose questions are usually malformed or compound
    if len(text) > 200:
        return f"question text too long: {len(text)} characters"

    # Must end with a question mark
    if not text.endswith("?"):
        return "question text does not end with '?'"

    # Markup or encoding artifacts leaked from source parsing
    if _MARKUP_RE.search(text):
        return "question text contains markup or encoding artifacts"

    # Math/calculation questions — answers must be recalled facts, not computed
    calc_patterns = [
        r"\bin total\b", r"\bthe sum\b", r"\bhow many .{0,30}\b(total|altogether|combined)\b",
        r"\bwhat is the (total|sum|product|difference|distance|speed|rate|cost|price|value)\b",
        r"\bcalculate\b", r"\bsolve\b", r"\bequals?\b",
        r"\bin (meters?|kilometres?|kilometers?|miles?|kg|pounds?|seconds?|minutes?|hours?)\b",
    ]
    for pattern in calc_patterns:
        if re.search(pattern, lower):
            return f"question appears to require calculation: matched '{pattern}'"

    # Contains embedded options (A), B), 1., 2., etc.)
    if re.search(r"\b[A-Da-d]\)", text) or re.search(r"\b[1-4]\.", text):
        return "question text contains embedded answer options"

    # Birth/death date questions — trivial memorisation, not knowledge
    birth_death_patterns = [
        r"\bin what year (was|were) .{1,40} born\b",
        r"\bwhen (was|were) .{1,40} born\b",
        r"\bwhat year (was|were) .{1,40} born\b",
        r"\bin what year did .{1,40} die\b",
        r"\bwhen did .{1,40} die\b",
        r"\bwhat year did .{1,40} die\b",
        r"\byear of (his|her|their) birth\b",
        r"\byear of (his|her|their) death\b",
        r"\bdate of (his|her|their) birth\b",
        r"\bdate of (his|her|their) death\b",
    ]
    for pattern in birth_death_patterns:
        if re.search(pattern, lower):
            return f"birth/death date question: matched '{pattern}'"

    # Subjective superlative framing — no objectively correct answer
    subjective_patterns = [
        r"\breached?\s+(its|the)\s+(best|peak|height|zenith|apex|pinnacle)\b",
        r"\bat\s+(its|the)\s+(best|peak|height|zenith|apex|pinnacle)\b",
        r"\b(greatest|finest|best)\s+\w+\s+of\s+all\s+time\b",
    ]
    for pattern in subjective_patterns:
        if re.search(pattern, lower):
            return f"question relies on subjective judgement: matched '{pattern}'"

    # Temporally relative language — questions must be timeless facts
    temporal_refs = [
        "current", "currently", "today", "now", "at present", "at the moment",
        "recent", "recently", "latest", "modern", "ongoing", "since", "this year",
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
    for ref in source_refs:
        if ref in lower:
            return f"question references source material: '{ref}'"

    return None


def _malformed_answers(q: Question) -> str | None:
    """Fast pre-check: return a rejection reason if any answer or distractor is malformed."""
    options = [
        ("correct_answer", q.correct_answer or ""),
        ("distractor_1", q.distractor_1 or ""),
        ("distractor_2", q.distractor_2 or ""),
        ("distractor_3", q.distractor_3 or ""),
    ]
    for field, text in options:
        text = text.strip()
        if len(text) > _MAX_ANSWER_LENGTH:
            return f"{field} exceeds {_MAX_ANSWER_LENGTH} characters ({len(text)} chars)"
        if _MARKUP_RE.search(text):
            return f"{field} contains markup or encoding artifacts: {repr(text)}"

    # All four options must be distinct (case-insensitive)
    seen: set[str] = set()
    for field, text in options:
        normalised = text.strip().lower()
        if normalised in seen:
            return f"duplicate answer option: '{text.strip()}' appears more than once"
        seen.add(normalised)

    # No distractor's words may be a subset of the correct answer's words (or vice versa)
    def _words(text: str) -> set[str]:
        return {w.strip("'\".,!?;:()[]{}") for w in text.lower().split() if len(w) > 2}

    answer_words = _words(q.correct_answer or "")
    for field, text in options[1:]:  # distractors only
        distractor_words = _words(text)
        if len(answer_words) >= 2 and len(distractor_words) >= 2:
            if answer_words <= distractor_words:
                return f"{field} words are a superset of the correct answer's words"
            if distractor_words <= answer_words:
                return f"correct answer words are a superset of {field}'s words"

    # No two distractors' words may be subsets of each other
    distractors = [(f, _words(t)) for f, t in options[1:] if t.strip()]
    for i, (f_i, d_i) in enumerate(distractors):
        for f_j, d_j in distractors[i + 1:]:
            if len(d_i) >= 2 and len(d_j) >= 2:
                if d_i <= d_j or d_j <= d_i:
                    return f"{f_i} and {f_j} words are subsets of each other"

    return None


def _build_validation_prompt(q: Question, feedback_block: str = "") -> str:
    return f"""{feedback_block}You are a trivia quality reviewer. Evaluate the following multiple-choice trivia question.

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
"latest", "modern", "ongoing", "since", "now", "this year", etc.) — questions must be timeless facts \
that will remain accurate indefinitely. "Which areas are threatened by the current fire?" \
is invalid because it goes out of date immediately. Reject these. \
- The question relies on subjective judgement rather than objective fact — e.g. \
"In which century did French literature reach its best?", "Who is the greatest novelist \
of all time?", "When did jazz reach its peak?" These have no single verifiable correct answer \
because they depend on opinion. Reject any question whose answer requires a value judgement \
rather than a documented fact. \
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
8. Is the category correct? \
Use "science" for questions about scientific discoveries, inventions, scientific concepts, \
scientists, and the history of science — even if the question has a historical angle. \
"Who discovered penicillin?" is science, not history. \
Use "history" only for questions primarily about political, military, or social history — \
wars, rulers, empires, revolutions, treaties, civilisations. \
When uncertain between two categories, prefer "general_knowledge" over a specific one.

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

        # Fetch unvalidated questions: not rejected, not duplicate, not seed, id > last checkpoint
        query = select(Question).where(
            Question.rejected == False,  # noqa: E712
            Question.is_duplicate == False,  # noqa: E712
            Question.source_type != "seed",
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

    feedback = build_feedback_retriever(db_path, "validate")
    console.print("[dim]Feedback retriever ready (embeddings loaded).")

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
                db_q.rejection_source = "validator"
                rejected += 1
                console.print(f"[red]  reject id={q.id}: {malformed_reason}")
                session.add(db_q)
                continue

            # Fast pre-check: malformed answers or distractors (saves LLM call)
            malformed_reason = _malformed_answers(q)
            if malformed_reason:
                db_q.rejected = True
                db_q.flag_reason = malformed_reason
                db_q.rejection_source = "validator"
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

            prompt = _build_validation_prompt(q, feedback(q.text))
            try:
                verdict: QuestionValidation = structured(prompt)
            except Exception as exc:
                console.print(f"[yellow]  id={q.id} validation failed: {exc} — skipping")
                continue

            if not verdict.is_valid or verdict.answer_in_question:
                db_q.rejected = True
                db_q.rejection_source = "validator"
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

        # Ensure last_processed_id covers the full batch — checkpoint interval may
        # not have fired if the batch was smaller than checkpoint_interval (e.g. 6 questions).
        if questions and (state_row.last_processed_id or 0) < questions[-1].id:
            state_row.last_processed_id = questions[-1].id

        # Advance last_processed_id past any duplicate questions that were skipped
        # by the query filter, so re-runs don't keep seeing them indefinitely.
        max_skipped_id = session.exec(
            select(func.max(Question.id)).where(
                Question.source_type != "seed",
                Question.is_duplicate == True,  # noqa: E712
                Question.id > (last_id or 0),
            )
        ).first()
        if max_skipped_id and (state_row.last_processed_id or 0) < max_skipped_id:
            state_row.last_processed_id = max_skipped_id

        session.add(state_row)
        session.commit()

    console.print(
        f"[green]Validate complete:[/green] "
        f"{len(questions) - rejected - flagged} passed, {rejected} rejected, "
        f"{flagged} flagged for review (difficulty/category suggestions)."
    )
