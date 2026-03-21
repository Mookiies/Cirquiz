"""Phase 2: Wikipedia extraction and LLM question generation."""

from __future__ import annotations

import bz2
import sys
import urllib.request
from pathlib import Path
from typing import Optional

from rich.console import Console
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    CHECKPOINT_INTERVAL,
    MODEL_NAME,
    QUESTIONS_PER_CHUNK,
    WIKIPEDIA_DUMP_PATH,
    WIKIPEDIA_DUMP_URL,
)
from models.db import PipelineState, Question, SourceChunk, init_db
from models.schemas import GeneratedQuestionBatch

console = Console()

# ── Category keyword mapping for Wikipedia articles ────────────────────────
_WIKI_KEYWORDS: dict[str, list[str]] = {
    "History": ["history", "war", "empire", "dynasty", "revolution", "ancient", "medieval", "historical"],
    "Science": ["science", "physics", "chemistry", "biology", "astronomy", "mathematics", "geology", "quantum"],
    "Geography": ["geography", "country", "capital", "continent", "mountain", "river", "ocean", "city", "region"],
    "Music": ["music", "song", "album", "band", "composer", "symphony", "opera", "musician", "jazz", "rock"],
    "Film & TV": ["film", "movie", "television", "actor", "director", "cinema", "series", "episode"],
    "Arts & Literature": ["literature", "novel", "poetry", "author", "painting", "sculpture", "art", "writer"],
    "Sport & Leisure": ["sport", "football", "basketball", "tennis", "olympic", "championship", "athlete"],
    "Society & Culture": ["religion", "culture", "mythology", "tradition", "language", "festival", "philosophy"],
    "Food & Drink": ["food", "cuisine", "recipe", "drink", "wine", "beer", "cooking", "restaurant", "dish"],
    "General Knowledge": [],  # catch-all
}


def _classify_article(title: str, text: str) -> str:
    combined = (title + " " + text[:500]).lower()
    for category, keywords in _WIKI_KEYWORDS.items():
        if category == "General Knowledge":
            continue
        if any(kw in combined for kw in keywords):
            return category
    return "General Knowledge"


def _chunk_text(text: str, chunk_size: int = 300) -> list[str]:
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


def _download_dump() -> None:
    if WIKIPEDIA_DUMP_PATH.exists():
        console.print(f"[dim]Wikipedia dump already present at {WIKIPEDIA_DUMP_PATH}")
        return
    console.print(f"Downloading Wikipedia dump from {WIKIPEDIA_DUMP_URL} …")
    urllib.request.urlretrieve(WIKIPEDIA_DUMP_URL, WIKIPEDIA_DUMP_PATH)
    console.print("[green]Download complete.")


def _parse_and_store_chunks(engine, category_filter: Optional[str] = None) -> int:
    """Parse Wikipedia XML dump, extract chunks, write to source_chunks table."""
    import mwxml  # type: ignore

    stored = 0
    with Session(engine) as session:
        already_parsed = session.exec(
            select(PipelineState).where(PipelineState.phase == "generate")
        ).first()
        if already_parsed and already_parsed.status == "complete":
            return session.exec(select(SourceChunk)).all().__len__()

    console.print("Parsing Wikipedia dump and extracting source chunks…")

    opener = bz2.open if str(WIKIPEDIA_DUMP_PATH).endswith(".bz2") else open
    with opener(WIKIPEDIA_DUMP_PATH, "rb") as f:
        dump = mwxml.Dump.from_file(f)
        with Session(engine) as session:
            for page in dump.pages:
                if page.namespace != 0:
                    continue
                for revision in page:
                    if not revision.text:
                        continue
                    title = page.title or ""
                    text = revision.text

                    category = _classify_article(title, text)
                    if category_filter and category != category_filter:
                        break

                    for chunk_text in _chunk_text(text):
                        chunk = SourceChunk(
                            source_type="wikipedia",
                            source_url=f"https://simple.wikipedia.org/wiki/{title.replace(' ', '_')}",
                            source_title=title,
                            category=category,
                            text=chunk_text,
                            processed=False,
                        )
                        session.add(chunk)
                        stored += 1

                    if stored % 500 == 0:
                        session.commit()
                    break  # only process latest revision

            session.commit()

    console.print(f"[green]{stored} source chunks stored.")
    return stored


def _build_generation_prompt(chunk_text: str, n: int) -> str:
    return f"""You are a trivia question writer. Given the following passage, generate exactly {n} multiple-choice trivia questions.

For each question:
- The question must be answerable solely from the passage
- The correct answer must appear in or be directly derivable from the passage
- The three distractors must be plausible but clearly wrong given the passage
- Assign difficulty: easy (commonly known), medium (requires knowledge), hard (obscure/nuanced)
- Assign confidence_score (0.0–1.0) reflecting how certain you are the question is factually correct

Passage:
\"\"\"
{chunk_text}
\"\"\"

Generate {n} questions."""


def run_generate(
    db_path: str,
    category: Optional[str] = None,
    limit: Optional[int] = None,
    model_name: str = MODEL_NAME,
) -> None:
    console.rule("[bold blue]Phase: Generate")

    engine = init_db(db_path)
    _download_dump()
    _parse_and_store_chunks(engine, category_filter=category)

    # Load model
    console.print(f"Loading model [bold]{model_name}[/bold] via MLX-LM…")
    try:
        import outlines  # type: ignore
        from mlx_lm import load  # type: ignore

        model, tokenizer = load(model_name)
        generator = outlines.models.mlxlm(model, tokenizer)
        structured = outlines.generate.json(generator, GeneratedQuestionBatch)
    except ImportError as exc:
        console.print(f"[red]Missing dependency: {exc}. Run: pip install -r requirements.txt")
        raise

    # Fetch unprocessed chunks
    with Session(engine) as session:
        query = select(SourceChunk).where(SourceChunk.processed == False)  # noqa: E712
        if category:
            query = query.where(SourceChunk.category == category)
        chunks = session.exec(query).all()

    if limit:
        chunks = chunks[:limit]

    if not chunks:
        console.print("[yellow]No unprocessed source chunks found.")
        return

    console.print(f"Generating questions for {len(chunks)} source chunks…")
    generated_total = 0
    checkpoint_count = 0

    with Session(engine) as session:
        state = session.exec(
            select(PipelineState).where(PipelineState.phase == "generate")
        ).first()
        if not state:
            state = PipelineState(phase="generate", status="running", items_total=len(chunks))
            session.add(state)
            session.commit()

        for i, chunk in enumerate(chunks):
            prompt = _build_generation_prompt(chunk.text, QUESTIONS_PER_CHUNK)
            try:
                batch: GeneratedQuestionBatch = structured(prompt)
            except Exception as exc:
                console.print(f"[yellow]Chunk {chunk.id} generation failed: {exc} — skipping")
                continue

            for q in batch.questions:
                question = Question(
                    source_chunk_id=chunk.id,
                    source_type="generated",
                    text=q.text,
                    correct_answer=q.correct_answer,
                    distractor_1=q.distractor_1,
                    distractor_2=q.distractor_2,
                    distractor_3=q.distractor_3,
                    category=chunk.category,
                    difficulty=q.difficulty,
                    confidence_score=q.confidence_score,
                )
                session.add(question)
                generated_total += 1

            chunk_record = session.get(SourceChunk, chunk.id)
            if chunk_record:
                chunk_record.processed = True
                session.add(chunk_record)

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
