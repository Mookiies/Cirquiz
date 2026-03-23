#!/usr/bin/env python3
"""Generate currency trivia questions and insert into generation.db.

Only includes countries with a distinctive, country-unique currency name.
Generic shared currencies (Dollar, Euro, Peso, Pound, Franc, Rupee, Dinar,
Rial, Ruble*, Krone, Shilling, Won**, Dirham, Manat, Som, Lira) are excluded
unless the base name is sufficiently unique to that country in the pool.

* Ruble is kept for Russia only since Belarus is not in this pool.
** Won is kept for South Korea only since North Korea is not in this pool.

Distractors are drawn from other currencies in the same distinctive pool —
every wrong answer is a real currency name, making the questions genuinely
challenging.
"""

import os
import random
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "generation.db")
CATEGORY = "geography"

# country → (short_currency_name, difficulty)
# Difficulty reflects how well-known the currency is to a pub-quiz player,
# not the country's fame. Easy = most adults know it; Hard = specialist knowledge.
CURRENCY_MAP: dict[str, tuple[str, str]] = {
    # Easy — currencies that are household names worldwide
    "Japan":         ("Yen",        "easy"),
    "Brazil":        ("Real",       "easy"),
    "South Africa":  ("Rand",       "easy"),
    "Russia":        ("Ruble",      "easy"),
    # Medium — well-known to anyone who travels or follows world news
    "China":         ("Renminbi",   "medium"),
    "Thailand":      ("Baht",       "medium"),
    "South Korea":   ("Won",        "medium"),
    "Malaysia":      ("Ringgit",    "medium"),
    "Indonesia":     ("Rupiah",     "medium"),
    "Vietnam":       ("Dong",       "medium"),
    "Israel":        ("Shekel",     "medium"),
    "Poland":        ("Zloty",      "medium"),
    "Hungary":       ("Forint",     "medium"),
    "Romania":       ("Leu",        "medium"),
    "Bulgaria":      ("Lev",        "medium"),
    "Czech Republic":("Koruna",     "medium"),
    "Nigeria":       ("Naira",      "medium"),
    "Ghana":         ("Cedi",       "medium"),
    "Guatemala":     ("Quetzal",    "medium"),
    "Peru":          ("Sol",        "medium"),
    "Iceland":       ("Krona",      "medium"),
    # Hard — real currencies but require genuine geography knowledge
    "Cambodia":      ("Riel",       "hard"),
    "Myanmar":       ("Kyat",       "hard"),
    "Laos":          ("Kip",        "hard"),
    "Mongolia":      ("Tugrik",     "hard"),
    "Ethiopia":      ("Birr",       "hard"),
    "Kazakhstan":    ("Tenge",      "hard"),
    "Georgia":       ("Lari",       "hard"),
    "Armenia":       ("Dram",       "hard"),
    "Angola":        ("Kwanza",     "hard"),
    "Mozambique":    ("Metical",    "hard"),
    "Madagascar":    ("Ariary",     "hard"),
    "Eritrea":       ("Nakfa",      "hard"),
    "Gambia":        ("Dalasi",     "hard"),
    "Sierra Leone":  ("Leone",      "hard"),
    "Bhutan":        ("Ngultrum",   "hard"),
    "Maldives":      ("Rufiyaa",    "hard"),
    "Kyrgyzstan":    ("Som",        "hard"),
    "Paraguay":      ("Guarani",    "hard"),
    "Albania":       ("Lek",        "hard"),
}

# Generic shared currencies excluded from questions (too many countries use them)
# but valid as distractors — recognisable names that make wrong answers plausible.
DISTRACTOR_EXTRAS = [
    "Dollar", "Euro", "Peso", "Pound", "Franc",
    "Rupee", "Dinar", "Rial", "Dirham", "Manat",
]


def build_distractors(correct: str, distractor_pool: list[str]) -> list[str]:
    """Pick 3 distractor currency names from the pool."""
    pool = [c for c in distractor_pool if c != correct]
    return random.sample(pool, 3)


def main():
    random.seed(42)

    all_currencies = [currency for currency, _ in CURRENCY_MAP.values()]
    distractor_pool = all_currencies + DISTRACTOR_EXTRAS

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Remove existing currency seed questions so we can re-insert fresh
    cur.execute(
        "DELETE FROM questions WHERE source_type = 'seed' AND text LIKE 'What is the currency of %'"
    )
    deleted = cur.rowcount
    if deleted:
        print(f"Removed {deleted} existing currency questions.")

    inserted = skipped = 0

    for country, (currency, difficulty) in CURRENCY_MAP.items():
        distractors = build_distractors(currency, distractor_pool)

        text = f"What is the currency of {country}?"

        try:
            cur.execute(
                """INSERT INTO questions
                   (source_type, text, correct_answer, distractor_1, distractor_2, distractor_3,
                    category, difficulty, confidence_score, is_duplicate, grounded, verified,
                    rejected, human_approved, edited, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                ("seed", text, currency, distractors[0], distractors[1], distractors[2],
                 CATEGORY, difficulty, 1.0, 0, 1, 1, 0, 1, 0),
            )
            inserted += 1
        except sqlite3.IntegrityError as e:
            print(f"Skipped {country}: {e}")
            skipped += 1

    conn.commit()
    conn.close()
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
