---
name: write-ritual-source
description: Rules for any traditional meaning, 'where this comes from' note, source card or archetype link. Use before touching lib/sources.ts, *-data.ts, archetype files, or text that says how old a meaning is.
---

# Writing traditional meanings and sources honestly

## Wording rules (from the user)
- The person's own meanings come first. The app's stock text is optional, labelled, and behind a button.
- **"Old" does not equal "better."** Never label anything "only modern" as a defect. Say where it came from and how settled it is, no more.
- **Never assert psi as proven, and never dismiss it.** The user believes in it. Use warm, non-dismissive wording ("people report", "some practitioners"), not "scientifically shown" and not "just superstition."
- Do not claim more than a source card says. Cards marked "not settled" or `unclear` stay that way.

## What is actually known (keep in the wording)
- Rune poems (Old English, Norwegian, Icelandic) and the medieval ogham glosses (the Auraicept tree names) exist, but **none gives a divination meaning**. The divination keys are modern (Blum 1982, Graves 1948 and later).
- Dice and coins: no old source gives a meaning per face. Number meanings are numerology from popular guides.
- Pendulum and scrying have **no traditional key**; guides disagree. "Traditional" there means common practice, labelled as such.
- Tarot: the Pixie-Smith text in `lib/cards.ts` and the encyclopedia data are the written basis.

## Basis labels
Every seeded meaning or archetype link names what it was drawn from: `poem`, `gloss`, `smith-waite`, `numerology`, `common practice` (plus `source_id` from `lib/sources.ts` where one exists). If nothing supports a piece (the five forfeda, added pendulum angles, large dice faces), say so; never invent a tradition.

## Adding or changing a source (`lib/sources.ts`)
1. Add a `Source` with a real `url` for that exact work (publisher, library catalogue, or review page).
2. Judge it on the owner's three tests: `lists` its sources, `record` (separates the historical record from hearsay), `magick` (treats divination as a serious subject). Use `unclear` when the check could not settle it; it is never a hidden "no."
3. State how it was checked. Reviews and publisher text are not the same as having read the book; say which.
4. No page numbers unless verified. A marker means "this topic is treated there."
5. Run `npm test` (`tests/sources.test.ts`), then regenerate the webliography: `npx tsx scripts/export-webliography.ts` (writes `docs/webliography.md`).

## Archetype links
- 85 roots in 12 realms live in `lib/archetypes-data.ts` and the `archetypes` table (`scripts/seed-archetypes.ts`). Slugs must exist before anything links to them.
- Concept sorting is in `data/concept-archetypes-*.txt`; `node scripts/check-archetype-map.mjs` checks the files. The database is the record after seeding; the admin page `/archetypes/review` edits it.
- Each link has an aspect (`light`, `shadow`, `neutral`) and may be primary. Upside-down runes and reversed tarot cards read the shadow side.
- A mapping is an interpretation: show it to the user for review before it is seeded.

## Before finishing
Add or update a test with each new data file. Keep notes in their own commit.
