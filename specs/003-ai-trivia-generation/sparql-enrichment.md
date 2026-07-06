# SPARQL Enrichment — Future Plan

## Summary

Integrate Wikidata SPARQL queries into the generate and validate phases to provide an independent,
GPU-free fact-check signal that supplements the LLM's self-assigned confidence score.

## Motivation

The current `confidence_score` is set by the generating LLM grading its own output — inherently
biased. The validate phase runs a second LLM pass but uses the same model (`Mistral-7B-Instruct-v0.2-4bit`),
which is the ceiling for the available hardware (pinned at ~85% GPU and memory utilization). There
is no independent, non-LLM signal in the pipeline today.

SPARQL queries against the Wikidata public endpoint are pure network calls — zero GPU cost — and
for well-covered categories can confirm or contradict the LLM's answer independently.

## Where SPARQL Fits

### Generate phase

Before the LLM generates a question, query Wikidata for structured facts about the entity/topic
in the source chunk. Pass those facts to the LLM as grounding context rather than letting it
recall from weights alone.

```
source chunk → LLM extracts entity → SPARQL fetches facts → LLM generates question from facts
```

Store `sparql_grounded = True/False` on the `Question` row.

### Validate phase

After the LLM validates a question, issue a second SPARQL query to independently verify the
correct answer against Wikidata.

```
Question + Answer → LLM generates SPARQL query → execute → compare result to correct_answer
```

Store `sparql_verified = True / False / None` on the `Question` row (`None` = Wikidata had no
match, neutral).

### Verify phase (confidence score composite)

Replace the single LLM self-score with a composite:

| Signal | Effect |
|--------|--------|
| LLM confidence_score (from generate) | base score |
| `sparql_verified == True` | +0.2 bonus |
| `sparql_verified == False` | -0.3 penalty (or auto-reject) |
| answer not in source chunk (existing) | -0.3 penalty |

## Category Coverage

SPARQL is only reliable for a subset of categories. Implement scoped to these first:

| Category | Coverage | Notes |
|----------|----------|-------|
| `geography` | High | Capitals, populations, borders, countries — well-structured in Wikidata |
| `science` | High | Discoveries, Nobel prizes, elements, scientists — well-covered |
| `history` | Medium | Major events, rulers, treaties — good coverage, gaps on minor events |
| `sport_and_leisure` | Medium | Major records and champions yes, niche facts no |
| `film_and_tv` | Medium | Release years, directors yes; plot questions no |
| `music` | Low-Medium | Albums, chart positions, band members — hit or miss |
| `arts_and_literature` | Low | Plot/themes not in Wikidata |
| `food_and_drink` | Low | Origins and ingredients poorly covered |
| `general_knowledge` | Low | Too broad to template |
| `society_and_culture` | Low | Too abstract |

**Start with `geography` and `science` only.** Expand if coverage proves useful.

## Expected Coverage

Realistically ~30-40% of questions will get a useful SPARQL signal. The rest return no match
(neutral — no penalty). This is acceptable: partial independent verification is better than none,
and the cost is zero GPU.

## Implementation Notes

### Wikidata endpoint

- URL: `https://query.wikidata.org/sparql`
- Rate limit: 60 requests/minute per IP
- Use a descriptive `User-Agent` header (required by Wikidata policy)
- `SPARQLWrapper` Python library handles the endpoint

### Query strategy

Two approaches, in order of preference:

1. **Template queries** — predefined SPARQL for known question patterns (e.g. "capital of X",
   "discovered by", "Nobel Prize year"). Fast, reliable, no extra LLM call.

2. **LLM-generated SPARQL** — ask the LLM to write a SPARQL query for the question, execute it,
   compare result. Flexible but adds a third LLM call and introduces SPARQL syntax failure modes.

Start with template queries for `geography` and `science`. Fall back to LLM-generated SPARQL
only if templates don't cover enough questions.

### Schema changes

Two new nullable columns on `Question`:

```python
sparql_grounded: bool | None  # True if generation was grounded by SPARQL facts
sparql_verified: bool | None  # True/False = verified/contradicted; None = no Wikidata match
```

### Rate limiting

```python
import time
time.sleep(1)  # between SPARQL calls — keeps well under 60 req/min
```

## Deferred Decisions

- Whether to auto-reject on `sparql_verified == False` or just penalise the score
- Exact bonus/penalty weights (tune empirically after first batch)
- Whether to expose `sparql_verified` in the curate UI as a signal to human reviewers
- LLM-generated SPARQL fallback — only implement if template coverage is insufficient
