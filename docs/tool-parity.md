# Tool parity map (X4b)

Written 2026-10-22. What each tool can do, so a capability one tool has is either available to the others or recorded here as deliberately missing. Update a row when a tool gains or drops a capability.

**Key:** ✓ has it · — deliberately missing (the reason is in the notes) · **gap** buildable, not done yet

## Every reading

These come from the shared reading record (`divinations`) and are on every tool's reading page, so they need no row each: tags (tarot uses `TagManager`, the others `DivinationTags`), share as text, predictions, add to a day, the sky line, journal entries, search of the question and the words written, export and import (`other_tool_readings`), the tally on Insights (`lib/tool-summary.ts`), "what you sensed first" (blind-target practice has its own sealed impression instead), the same-question card and the look-back reminder.

## By tool

| Tool | Own library page per piece | Archetype links on the piece page | "Times it came up" | Cloth (where it landed; recorded on the Tossing lots page, `/lots`, since 2026-10-31) | Recurring on Patterns | Companion, interviewer and guide |
|---|---|---|---|---|---|---|
| Tarot | ✓ `/cards/[id]` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Oracle deck | ✓ `/oracle/cards/[id]` | — the items are the person's own; they link them themselves | ✓ | ✓ | ✓ | ✓ |
| Runes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ogham | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dice and coins | ✓ per face | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pendulum | ✓ swings | ✓ | — an answer is a swing, listed on the swings page | — nothing is thrown | ✓ | ✓ |
| Scrying | — one surface per session | ✓ per surface | — | — nothing is thrown | ✓ | ✓ |
| I Ching | ✓ `/iching/set/[n]` | **gap** (BIB1: a draft is in `data/symbol-archetypes-iching.txt`, 2026-10-29, for the owner to review before it is seeded) | ✓ | — the cast is lines, not objects on a cloth | ✓ | ✓ |
| Geomancy | ✓ `/geomancy/set/[figure]` | **gap** (BIB1: a draft is in `data/symbol-archetypes-geomancy.txt`, as above) | ✓ | — the figures come from marks, not objects on a cloth | ✓ | ✓ |
| Bibliomancy | — the passages are the person's own writing | — | — | — | ✓ words | ✓ |
| Playing cards | ✓ `/playingcards/set/[id]` | **gap** (no source has been checked yet; see `/sources`) | ✓ | ✓ (2026-10-22) | ✓ | ✓ (2026-10-22) |
| Charm casting | — the charms are an oracle set of the person's own | — as for the oracle deck | — | ✓ its own square cloth, and onto one of the person's cloths with zones, laid as it fell or recorded by hand (2026-10-29) | ✓ | ✓ (2026-10-22) |
| Signs and dreams | — a note, not a method | — | — | — | ✓ words used in three or more notes (2026-10-29) | ✓ (2026-10-22) |
| Blind-target practice | — | — | — | — | — no pieces | — the target and the options are sealed until the choice is made, and the trial is practice without help |
| Tasseomancy (tea leaves; its own tool since 2026-10-29) | — the leaves are random each time | — no tradition's meanings are used; the choice of teas is sourced | — | — | — no pieces | ✓ (2026-10-22) |
| Inkblots (its own tool since 2026-10-29) | — the blot is random each time | — | — | — | — no pieces | ✓ (2026-10-22) |

## Gaps left

1. Archetype links for hexagrams, geomancy figures and playing cards. The hexagram and figure drafts (2026-10-29, from the names only) need the owner's review and a check against Legge and a printed geomancy manual before they are added to `lib/symbol-seed-sets.ts` (BIB1); playing cards need a checked source first.

Related open items: R1, R8, BIB1, NT1 (`docs/open-items.md`).
