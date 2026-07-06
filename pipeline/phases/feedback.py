"""Semantic retrieval of human correction examples for few-shot prompt context.

Usage:
    retriever = build_feedback_retriever(db_path, "validate")  # once per run
    block = retriever(question_text)                           # once per question/chunk
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Callable, Literal

import numpy as np
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.db import Question, ReviewQueue, init_db

_EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
_TOP_K = 8
_POSITIVE_TOP_K = 3
# Truncate query text to keep embeddings fast (model max is 256 tokens)
_MAX_QUERY_CHARS = 1000
_EXAMPLES_PATH = Path(__file__).parent.parent / "examples.json"


def _classify(q: Question) -> list[str]:
    types = []
    if q.original_category and q.original_category != q.category:
        types.append("category")
    if q.original_difficulty and q.original_difficulty != q.difficulty:
        types.append("difficulty")
    if q.original_correct_answer and q.original_correct_answer != q.correct_answer:
        types.append("answer")
    if q.original_text and q.original_text != q.text:
        types.append("text")
    if any([
        q.original_distractor_1 and q.original_distractor_1 != q.distractor_1,
        q.original_distractor_2 and q.original_distractor_2 != q.distractor_2,
        q.original_distractor_3 and q.original_distractor_3 != q.distractor_3,
    ]):
        types.append("distractor")
    return types


def _correction_embed_text(q: Question) -> str:
    """Text to embed for a correction — the original question the model produced."""
    base = q.original_text or q.text
    return f"{base} Answer: {q.original_correct_answer or q.correct_answer}"


def _format_block(corrections: list[Question], for_phase: Literal["generate", "validate"]) -> str:
    """Format a list of corrections into a prompt block grouped by correction type."""
    classified: dict[str, list[Question]] = {
        "category": [], "difficulty": [], "answer": [], "distractor": [], "text": [],
    }
    for q in corrections:
        for t in _classify(q):
            classified[t].append(q)

    if for_phase == "validate":
        sections = []

        if classified["category"]:
            examples = "\n\n".join(
                f'  Q: "{q.text}"\n'
                f"  Correct answer: {q.correct_answer}\n"
                f"  Model assigned: {q.original_category!r}  →  Human corrected to: {q.category!r}"
                for q in classified["category"]
            )
            sections.append("Category corrections:\n\n" + examples)

        if classified["difficulty"]:
            examples = "\n\n".join(
                f'  Q: "{q.text}"\n'
                f"  Correct answer: {q.correct_answer}\n"
                f"  Model assigned: {q.original_difficulty!r}  →  Human corrected to: {q.difficulty!r}"
                for q in classified["difficulty"]
            )
            sections.append("Difficulty corrections:\n\n" + examples)

        if not sections:
            return ""

        return (
            "=== HUMAN CALIBRATION EXAMPLES ===\n"
            "A human reviewer corrected the following model outputs. "
            "Use these to calibrate your own category and difficulty judgements — "
            "pay close attention to the pattern of mistakes:\n\n"
            + "\n\n".join(sections)
            + "\n=== END CALIBRATION ===\n\n"
        )

    else:  # generate
        parts = []

        if classified["category"]:
            examples = "\n".join(
                f'  - "{q.text}"\n'
                f"    Answer: {q.correct_answer}  |  was {q.original_category!r} → corrected to {q.category!r}"
                for q in classified["category"]
            )
            parts.append("Category misassignments — avoid repeating these:\n" + examples)

        if classified["difficulty"]:
            examples = "\n".join(
                f'  - "{q.text}"\n'
                f"    Answer: {q.correct_answer}  |  was {q.original_difficulty!r} → corrected to {q.difficulty!r}"
                for q in classified["difficulty"]
            )
            parts.append("Difficulty misassignments — avoid repeating these:\n" + examples)

        if classified["answer"]:
            examples = "\n".join(
                f'  - Q: "{q.original_text}"\n'
                f"    Model said: {q.original_correct_answer!r}  →  Correct answer: {q.correct_answer!r}"
                for q in classified["answer"]
            )
            parts.append("Factual errors corrected by human reviewers:\n" + examples)

        if classified["distractor"]:
            examples = "\n".join(
                f'  - Q: "{q.text}" (answer: {q.correct_answer})\n'
                f"    Old distractors: {q.original_distractor_1!r}, {q.original_distractor_2!r}, {q.original_distractor_3!r}\n"
                f"    Corrected to:    {q.distractor_1!r}, {q.distractor_2!r}, {q.distractor_3!r}"
                for q in classified["distractor"]
            )
            parts.append("Distractor corrections:\n" + examples)

        if not parts:
            return ""

        return (
            "=== HUMAN FEEDBACK FROM PRIOR RUNS ===\n"
            "The following questions were generated by this model and then corrected by a human reviewer. "
            "Study these corrections carefully — do not repeat the same mistakes:\n\n"
            + "\n\n".join(parts)
            + "\n=== END FEEDBACK ===\n\n"
        )


def _format_validator_rejection_block(rejections: list[Question]) -> str:
    """Format questions where the validator suggested a change but the human disagreed."""
    import re
    lines = []
    for q in rejections:
        if not q.flag_reason:
            continue
        diff_match = re.search(r"difficulty suggested: '([^']+)' \(was '([^']+)'\)", q.flag_reason)
        cat_match = re.search(r"category suggested: '([^']+)' \(was '([^']+)'\)", q.flag_reason)
        parts = []
        if diff_match:
            parts.append(
                f"  validator suggested difficulty={diff_match.group(1)!r} but human kept {diff_match.group(2)!r}"
            )
        if cat_match:
            parts.append(
                f"  validator suggested category={cat_match.group(1)!r} but human kept {cat_match.group(2)!r}"
            )
        if parts:
            lines.append(f'  Q: "{q.text}"\n  Correct answer: {q.correct_answer}\n' + "\n".join(parts))
    return "\n\n".join(lines)


def _format_positive_examples(examples: list[dict]) -> str:
    """Format a list of curated example dicts into a positive-example prompt block."""
    if not examples:
        return ""
    lines = []
    for ex in examples:
        lines.append(
            f'Q: "{ex["question"]}"\n'
            f'A: {ex["correct_answer"]}\n'
            f'Wrong: {ex["distractor_1"]} | {ex["distractor_2"]} | {ex["distractor_3"]}\n'
            f'Category: {ex["category"]} | Difficulty: {ex["difficulty"]}'
        )
    body = "\n\n".join(lines)
    return (
        "=== GOLD-STANDARD EXAMPLE QUESTIONS ===\n"
        "These are high-quality trivia questions. Aim to write questions of this calibre:\n\n"
        + body
        + "\n=== END EXAMPLES ===\n\n"
    )


class FeedbackRetriever:
    """Holds correction embeddings in memory; retrieves top-K per query at call time."""

    def __init__(
        self,
        corrections: list[Question],
        embeddings: np.ndarray,
        model: object,
        for_phase: Literal["generate", "validate"],
        top_k: int,
        item_kind: list[str] | None = None,
        positive_examples: list[dict] | None = None,
        positive_embeddings: np.ndarray | None = None,
        positive_top_k: int = _POSITIVE_TOP_K,
    ) -> None:
        self._corrections = corrections
        self._embeddings = embeddings  # shape (N, dim), L2-normalised
        self._model = model
        self._for_phase = for_phase
        self._top_k = top_k
        self._item_kind = item_kind or ["correction"] * len(corrections)
        self._positive_examples = positive_examples or []
        self._positive_embeddings = positive_embeddings  # shape (M, dim), L2-normalised
        self._positive_top_k = positive_top_k

    def __call__(self, query_text: str) -> str:
        query = query_text[:_MAX_QUERY_CHARS]
        query_emb = self._model.encode([query], normalize_embeddings=True)  # (1, dim)

        parts = []

        # Retrieve positive examples (generate phase only)
        if (
            self._for_phase == "generate"
            and self._positive_examples
            and self._positive_embeddings is not None
        ):
            pos_scores = (self._positive_embeddings @ query_emb.T).squeeze()  # (M,)
            if pos_scores.ndim == 0:
                pos_idx = [0]
            else:
                pos_idx = np.argsort(pos_scores)[::-1][: self._positive_top_k].tolist()
            retrieved_positives = [self._positive_examples[i] for i in pos_idx]
            block = _format_positive_examples(retrieved_positives)
            if block:
                parts.append(block)

        # Retrieve corrections (both phases)
        if self._corrections:
            scores = (self._embeddings @ query_emb.T).squeeze()  # (N,)
            if scores.ndim == 0:
                top_idx = [0]
            else:
                top_idx = np.argsort(scores)[::-1][: self._top_k].tolist()

            by_kind: dict[str, list[Question]] = {
                "correction": [],
                "validator_rejection": [],
            }
            for i in top_idx:
                by_kind[self._item_kind[i]].append(self._corrections[i])

            if by_kind["correction"]:
                parts.append(_format_block(by_kind["correction"], self._for_phase))

            if by_kind["validator_rejection"]:
                body = _format_validator_rejection_block(by_kind["validator_rejection"])
                if body:
                    parts.append(
                        "=== VALIDATOR OVER-CORRECTIONS ===\n"
                        "The validator suggested changes for the following questions, "
                        "but a human reviewer disagreed and kept the original values. "
                        "Do not repeat these over-corrections:\n\n"
                        + body
                        + "\n=== END VALIDATOR OVER-CORRECTIONS ===\n"
                    )

        return "\n".join(parts)


def _load_validator_rejections(session: Session) -> list[Question]:
    """Load questions where the validator suggested a change but the human disagreed."""
    rows = session.exec(
        select(Question, ReviewQueue)
        .join(ReviewQueue, ReviewQueue.question_id == Question.id)  # type: ignore[arg-type]
        .where(
            ReviewQueue.validator_suggestion_accepted == False,  # noqa: E712
            ReviewQueue.status == "approved",
            Question.human_approved == True,  # noqa: E712
        )
    ).all()
    return [q for q, _ in rows]


def _load_positive_examples() -> list[dict]:
    """Load curated positive example questions from examples.json."""
    if not _EXAMPLES_PATH.exists():
        return []
    try:
        with open(_EXAMPLES_PATH) as f:
            return json.load(f)
    except Exception:
        return []


def build_feedback_retriever(
    db_path: str,
    for_phase: Literal["generate", "validate"],
    top_k: int = _TOP_K,
    positive_top_k: int = _POSITIVE_TOP_K,
) -> Callable[[str], str]:
    """Load corrections from DB, embed them, return a retriever callable.

    Covers three signals:
    - Curated positive examples (gold-standard questions to aim for; generate only)
    - Human-edited questions (model was wrong, human corrected it)
    - Validator-flagged questions the human disagreed with (validator was wrong)

    Returns a no-op callable (always returns '') if there are no examples/corrections
    or if sentence-transformers is not installed.
    """
    _noop: Callable[[str], str] = lambda _: ""

    engine = init_db(db_path)
    with Session(engine) as session:
        corrections = session.exec(
            select(Question)
            .where(
                Question.edited == True,  # noqa: E712
                Question.human_approved == True,  # noqa: E712
                Question.original_text != None,  # noqa: E711
            )
            .order_by(Question.id)
        ).all()

        validator_rejections = _load_validator_rejections(session)

    positive_examples = _load_positive_examples() if for_phase == "generate" else []

    if not corrections and not validator_rejections and not positive_examples:
        return _noop

    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError:
        return _noop

    model = SentenceTransformer(_EMBED_MODEL_NAME)

    # Embed correction examples
    correction_embeddings: np.ndarray | None = None
    all_items = list(corrections) + list(validator_rejections)
    item_kind = (
        ["correction"] * len(corrections)
        + ["validator_rejection"] * len(validator_rejections)
    )
    if all_items:
        texts = [_correction_embed_text(q) for q in all_items]
        correction_embeddings = model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False
        )

    # Embed positive examples (generate phase only)
    positive_embeddings: np.ndarray | None = None
    if positive_examples:
        pos_texts = [
            f"{ex['question']} Answer: {ex['correct_answer']}"
            for ex in positive_examples
        ]
        positive_embeddings = model.encode(
            pos_texts, normalize_embeddings=True, show_progress_bar=False
        )

    return FeedbackRetriever(
        corrections=all_items,
        embeddings=correction_embeddings if correction_embeddings is not None else np.empty((0, 1)),
        model=model,
        for_phase=for_phase,
        top_k=min(top_k, len(all_items)) if all_items else 0,
        item_kind=item_kind,
        positive_examples=positive_examples,
        positive_embeddings=positive_embeddings,
        positive_top_k=positive_top_k,
    )
