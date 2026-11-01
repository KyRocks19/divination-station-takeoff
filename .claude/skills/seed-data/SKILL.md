---
name: seed-data
description: Seed or re-seed encyclopedia/concept/reversed-meaning data from the CSVs. Use when importing CSV or concept data or running scripts/seed-*.ts.
---

# Seeding card & concept data

Reference data (CSVs, `card_concepts.txt`, `concepts.txt`, `EncyclopediaArcana/`, legacy `tarot.db`) lives **outside the repo** in
`../divination-station-reference/` (the old `../crossroads-of-tarot-reference/` is still found) (override with the `SEED_DATA_DIR` env var).

## Scripts and their source data
| Script | Reads | Writes |
|---|---|---|
| `scripts/seed-encyclopedia.ts` | read the file for its sources | concepts, card_concepts |
| `scripts/seed-reversed-concepts.ts` | `St. Cepesa Horat - R Meanings Duplicates.csv` | reversed card_concepts edges |
| `scripts/seed-reversed-major-arcana.ts` | `St. Cepesa Horat - R Major Arcana Meanings.csv` | reversed Major Arcana edges |
| `scripts/import-sqlite.ts` | legacy `tarot.db` | one-time import (see header usage) |

Other CSVs in the root (Minor Arcana, Numerology, Zodiac, Major Arcana Associations, Reverses, R Matrix Duplicates,
TowerIdeas) plus `card_concepts.txt` / `concepts.txt` are source material. Some are wired into
`lib/card-associations.ts` and some are not yet imported, so check before assuming.

## Workflow (live Neon DB guard rails)
1. Read the script and the CSV header and first rows; summarize what will be inserted or updated.
2. Run `npx tsx scripts/<name>.ts --dry-run`. Every seed script supports it: the whole run happens inside a
   transaction that is rolled back, so you get real counts (parsed, new vs existing concepts and edges, unmatched
   names) and nothing is saved. New seed scripts must support `--dry-run` the same way.
3. Show the user the dry-run result and get an explicit OK before the real run.
4. Run `npx tsx scripts/<name>.ts` without the flag (the seed scripts load `.env.local` themselves).
5. Verify with a count query and report numbers. Scripts should be idempotent; confirm a second run changes nothing.

## Conventions
- Concept names are normalized with a capitalizing helper (`toDisplayName`); keep new scripts consistent.
- Reversed edges use `card_concepts.reversed = true` (migration 011); the primary key includes `reversed`.
- New scripts: header comment with the CSV name, "Idempotent", and a `Usage:` line.
- CSVs may contain curly quotes or BOMs; trim and normalize when matching names.
