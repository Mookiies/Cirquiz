"""Phase 2: Wikipedia extraction and LLM question generation."""

from __future__ import annotations

import concurrent.futures
import re
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeElapsedColumn
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    CHECKPOINT_INTERVAL,
    MODEL_NAME,
    QUESTIONS_PER_CHUNK,
    WIKIPEDIA_DATASET,
)
from models.db import PipelineState, Question, SourceChunk, init_db
from models.schemas import GeneratedQuestionBatch
from phases.feedback import build_feedback_retriever

console = Console()


_PLACEHOLDER_FRAGMENTS = [
    "there is no correct answer",
    "no correct answer",
    "no answer in the passage",
    "cannot be determined",
    "not mentioned in the passage",
    "not provided in the passage",
    "the passage does not",
    # Template literals the model emits when degrading
    "question goes here",
    "your question here",
    "question text here",
    "insert question",
    "answer goes here",
    "your answer here",
]

# Matches angle-bracket placeholders: <Your_Question>, <answer>, <Option 1>, etc.
_ANGLE_BRACKET_RE = re.compile(r"<[A-Za-z_\s]+>")
# Matches bare template names: "Question1", "Question 2", "Answer1", "Option A", "Distractor 1"
_NUMERIC_TEMPLATE_RE = re.compile(r"^(question|answer|option|distractor)\s*[\d]+$", re.IGNORECASE)

_SOURCE_REF_FRAGMENTS = [
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


def _is_placeholder(value: str) -> bool:
    """Return True if the model produced a non-answer instead of real content."""
    lower = (value or "").lower().strip()
    if not lower:
        return True
    if any(frag in lower for frag in _PLACEHOLDER_FRAGMENTS):
        return True
    if _ANGLE_BRACKET_RE.search(value):
        return True
    if _NUMERIC_TEMPLATE_RE.match(lower):
        return True
    # Degenerate output: string is only punctuation/ellipsis with no real content
    if not re.sub(r"[.…?!\s]", "", lower):
        return True
    return False


def _references_source(text: str) -> bool:
    """Return True if the question text references the source passage."""
    lower = (text or "").lower()
    return any(frag in lower for frag in _SOURCE_REF_FRAGMENTS)



def _chunk_text(text: str, chunk_size: int = 450) -> list[str]:
    """Split text into ~chunk_size word passages at sentence boundaries."""
    sentences = text.replace("\n", " ").split(". ")
    chunks: list[str] = []
    current: list[str] = []
    word_count = 0

    for sentence in sentences:
        words = sentence.split()
        if word_count + len(words) > chunk_size and current:
            chunks.append(". ".join(current) + ".")
            current = [sentence]
            word_count = len(words)
        else:
            current.append(sentence)
            word_count += len(words)

    if current:
        chunks.append(". ".join(current))

    return [c for c in chunks if len(c.split()) >= 50]  # skip tiny chunks


def _load_and_store_chunks(engine) -> int:
    """Stream the HuggingFace Wikipedia dataset and write chunks to source_chunks table."""
    from datasets import load_dataset  # type: ignore

    with Session(engine) as session:
        parse_state = session.exec(
            select(PipelineState).where(PipelineState.phase == "parse")
        ).first()
        if parse_state and parse_state.status == "complete":
            count = len(session.exec(select(SourceChunk)).all())
            console.print(f"[dim]Wikipedia already loaded — {count} chunks in DB, skipping.")
            return count

        if not parse_state:
            parse_state = PipelineState(phase="parse", status="running")
            session.add(parse_state)
            session.commit()

    console.print(f"Loading Wikipedia dataset [bold]{WIKIPEDIA_DATASET}[/bold] from HuggingFace…")
    dataset = load_dataset("wikipedia", WIKIPEDIA_DATASET, split="train", trust_remote_code=True)
    console.print(f"[green]{len(dataset)} articles loaded. Chunking and storing…")

    stored = 0
    with Session(engine) as session:
        for article in dataset:
            title = article["title"] or ""
            text = article["text"] or ""
            url = article["url"] or ""

            for chunk_text in _chunk_text(text):
                session.add(SourceChunk(
                    source_type="wikipedia",
                    source_url=url,
                    source_title=title,
                    category="general_knowledge",
                    text=chunk_text,
                    processed=False,
                ))
                stored += 1

            if stored % 500 == 0:
                session.commit()

        session.commit()

    with Session(engine) as session:
        parse_state = session.exec(
            select(PipelineState).where(PipelineState.phase == "parse")
        ).first()
        parse_state.status = "complete"
        parse_state.items_processed = stored
        session.add(parse_state)
        session.commit()

    console.print(f"[green]{stored} source chunks stored.")
    return stored


def _build_generation_prompt(chunk_text: str, n: int, feedback_block: str = "") -> str:
    return f"""{feedback_block}You are a trivia question writer. Your goal is to write questions that feel at home in a pub quiz — \
questions that a curious, well-read adult might know, might half-know, or might be surprised by. \
A great trivia question has an "aha" moment: the answer is satisfying to get right and genuinely \
interesting to learn if you got it wrong.

=== WHAT MAKES A GOOD QUESTION ===
- The answer is something a smart person COULD know but might not — not something everyone knows \
immediately, and not something only a specialist would ever encounter.
- Prefer asking WHAT someone did, discovered, or created over WHEN they did it. \
"Which scientist first described natural selection?" is better than "In what year did Darwin \
publish On the Origin of Species?" — the what teaches you something, the date rarely does.
- NEVER ask when someone was born or died. Birth and death years are arbitrary facts that reward \
memorisation, not knowledge. Ask what someone did, discovered, or created instead.
- Date questions are only acceptable when the date itself is iconic and universally recognised \
(moon landing, D-Day, fall of the Berlin Wall). For any niche or obscure topic, never ask a \
date question — it rewards nothing.
- The fact being tested should be notable or surprising in its own right. If knowing the answer \
feels arbitrary — if it's just a detail that happens to appear in the passage — skip it.
- Distractors must feel like real guesses to someone who doesn't know the answer. Wrong options \
that are obviously wrong (wrong continent, wrong century, wildly different field) make the \
question trivially easy. Each distractor should be something a reasonable person might plausibly \
believe is correct.
- Connections and surprising facts make the best questions: "Which two things are linked by X?" \
or "What unexpected property does X have?" These create genuine engagement.

=== WHEN TO SKIP THIS PASSAGE — return an empty list ===
Ask yourself: could a typical pub quiz use this passage as a source? If the answer is no, skip it.
Skip the passage if ANY of the following are true:
- It is primarily a list (discography, bibliography, roster, timeline of dates) with no narrative \
context — lists produce trivial or arbitrary questions.
- It is a Wikipedia stub, disambiguation page, or meta-article about editing.
- Every interesting fact in the passage is too niche or local to be general knowledge — \
if a reasonably well-read adult would have no realistic chance of knowing the answer, skip it.
- The only extractable facts are dates or numbers for obscure events.
- The passage is about fictional characters, made-up scenarios, or contains math problems \
with invented values.
- You cannot write a distractor that would fool anyone — the wrong answers would be obvious \
to anyone who reads the question.
Do NOT force a question from a bad passage. An empty list is the correct output when the \
passage doesn't support a good question.

=== STRICT RULES ===
- The question must be fully self-contained — a player sees ONLY the question and four answer \
options, never the passage. NEVER reference "the passage", "the text", "the article", \
"as mentioned", or any image, photo, diagram, or map.
- The question text must be a single sentence ending in "?". No embedded options, no lists, \
no multiple sentences.
- Questions must be timeless — NEVER use "current", "currently", "today", "recent", "latest", \
"modern", "ongoing", "since", or "now". Ask about permanent historical facts only.
- NEVER ask questions based on subjective judgement — "greatest", "best", "reached its peak", \
"finest of all time" have no single correct answer. Every question must have one verifiable fact.
- NEVER generate math or calculation questions. Trivia answers are recalled facts, not computed results.
- Each answer option must be a single item, never a comma-separated list. If the passage lists \
several things sharing a property, ask about ONE of them with three plausible distractors.
- All four options must be the same type and format — never mix "4200 BC" with "10,500 years ago", \
or a compound answer with single-item answers.
- The correct answer must NOT be identifiable by format or length alone.

=== CATEGORY & DIFFICULTY ===
Assign the single most accurate category from exactly this list: \
arts_and_literature, film_and_tv, general_knowledge, geography, history, music, science, \
sport_and_leisure, society_and_culture, food_and_drink.
- Use "science" for scientific discoveries, inventions, concepts, and scientists — even with a \
historical angle. "Who discovered penicillin?" is science, not history.
- Use "history" only for political, military, or social history — wars, rulers, empires, \
revolutions, treaties.
- When uncertain between two categories, default to "general_knowledge".

Difficulty reflects how likely a typical pub quiz player is to know the answer:
- easy: most players would know this
- medium: maybe half of players would know this
- hard: only well-informed players would know this — but it's still a fair question, not an \
arbitrary one. A hard question should feel hard because the subject is specialised, not because \
the fact is trivially obscure.

Assign confidence_score (0.0–1.0) reflecting how certain you are the question is factually correct.

Passage:
\"\"\"
{chunk_text}
\"\"\"

Generate {n} questions, or return an empty list if the passage does not support a good question."""


def _init_model(model_name: str):
    """Load the MLX model and return (generator, structured) — call again to restart."""
    try:
        import outlines  # type: ignore
    except ImportError as exc:
        console.print(f"[red]Missing dependency: {exc}. Run: pip install -r requirements.txt")
        raise
    console.print(f"Loading model [bold]{model_name}[/bold] via MLX-LM…")
    generator = outlines.models.mlxlm(model_name)
    structured = outlines.generate.json(generator, GeneratedQuestionBatch)
    return generator, structured


def _restart_model(model_name: str, generator, structured):
    """Tear down the current model, clear Metal cache, and reload fresh."""
    console.print("[yellow]Restarting model to clear accumulated state…")
    del generator, structured
    try:
        import mlx.core as mx  # type: ignore
        mx.metal.clear_cache()
    except Exception:
        import gc
        gc.collect()
    return _init_model(model_name)


def run_generate(
    db_path: str,
    limit: Optional[int] = None,
    model_name: str = MODEL_NAME,
    restart_every: Optional[int] = None,
) -> None:
    console.rule("[bold blue]Phase: Generate")

    engine = init_db(db_path)
    _load_and_store_chunks(engine)

    generator, structured = _init_model(model_name)

    # Fetch unprocessed chunks
    with Session(engine) as session:
        query = select(SourceChunk).where(SourceChunk.processed == False)  # noqa: E712
        chunks = session.exec(query).all()

    if limit:
        chunks = chunks[:limit]

    if not chunks:
        console.print("[yellow]No unprocessed source chunks found.")
        return

    feedback = build_feedback_retriever(db_path, "generate")
    console.print("[dim]Feedback retriever ready (embeddings loaded).")

    console.print(f"Generating questions for {len(chunks)} source chunks…")
    generated_total = 0
    checkpoint_count = 0

    progress = Progress(
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("•"),
        TimeElapsedColumn(),
        console=console,
    )

    with progress, Session(engine) as session:
        task = progress.add_task("Generating — 0 questions", total=len(chunks))

        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "generate")
        ).first()
        if not state:
            state = PipelineState(phase="generate", status="running", items_total=len(chunks))
            session.add(state)
            session.commit()

        for i, chunk in enumerate(chunks):
            if restart_every and i > 0 and i % restart_every == 0:
                generator, structured = _restart_model(model_name, generator, structured)

            prompt = _build_generation_prompt(chunk.text, QUESTIONS_PER_CHUNK, feedback(chunk.text))
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(structured, prompt)
                    batch: GeneratedQuestionBatch = future.result(timeout=180)
            except concurrent.futures.TimeoutError:
                console.print(f"[yellow]Chunk {chunk.id} timed out after 180s — skipping")
                chunk_record = session.get(SourceChunk, chunk.id)
                if chunk_record:
                    chunk_record.processed = True
                    session.add(chunk_record)
                session.commit()
                continue
            except Exception as exc:
                console.print(f"[yellow]Chunk {chunk.id} generation failed: {exc} — skipping")
                continue

            for q in batch.questions:
                # Drop questions where the model couldn't produce a real answer
                if _is_placeholder(q.correct_answer) or _is_placeholder(q.text):
                    console.print(
                        f"[yellow]Chunk {chunk.id} — skipping question with placeholder content"
                    )
                    continue

                # Drop questions that reference the source passage
                if _references_source(q.text):
                    console.print(
                        f"[yellow]Chunk {chunk.id} — skipping question referencing source material"
                    )
                    continue

                question = Question(
                    source_chunk_id=chunk.id,
                    source_type="generated",
                    text=q.text,
                    correct_answer=q.correct_answer,
                    distractor_1=q.distractor_1,
                    distractor_2=q.distractor_2,
                    distractor_3=q.distractor_3,
                    category=q.category,
                    difficulty=q.difficulty,
                    confidence_score=q.confidence_score,
                    original_text=q.text,
                    original_correct_answer=q.correct_answer,
                    original_distractor_1=q.distractor_1,
                    original_distractor_2=q.distractor_2,
                    original_distractor_3=q.distractor_3,
                    original_category=q.category,
                    original_difficulty=q.difficulty,
                )
                session.add(question)
                generated_total += 1

            chunk_record = session.get(SourceChunk, chunk.id)
            if chunk_record:
                chunk_record.processed = True
                session.add(chunk_record)

            progress.advance(task)
            progress.update(task, description=f"Generating — {generated_total} questions")

            checkpoint_count += 1
            if checkpoint_count % CHECKPOINT_INTERVAL == 0:
                state.last_processed_id = chunk.id
                state.items_processed = i + 1
                session.add(state)
                session.commit()
                console.print(
                    f"[dim]Checkpoint: {i + 1}/{len(chunks)} chunks processed, "
                    f"{generated_total} questions generated"
                )

        state.status = "complete"
        state.items_processed = len(chunks)
        session.add(state)
        session.commit()

    console.print(f"[green]Generate complete:[/green] {generated_total} questions generated.")
