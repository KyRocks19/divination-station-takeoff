---
name: oracle-feature-design
description: The goal and ten design rules for the oracle kit, divination tools, meanings, interpretations and AI guidance. Load only for work that touches those.
---

# Oracle deck kit

## The goal (read this first, every session)
**A person makes their own oracle deck out of their own life, and using it sharpens their own intuition.**

Cards come from the user's memories, feelings, principles, loves, and scenes. The user is the only author of
what a card means. The app holds their words and reflects them back; it never supplies a meaning.

The Pixie-Smith tarot deck elsewhere in the app is an optional example of how divination works. It is not the
base, the template, or the answer key for an oracle deck. (The rules for tarot itself and for AI guidance are in
"Tarot and AI guidance" below; they used to be a separate skill, `intuition-feature-design`.)

If a piece of work does not serve the goal sentence above, it goes in `docs/open-items.md` as PARKED.

## How to work in a session
These rules exist so the project reaches its end without drifting. They apply to Claude.

1. **Start from the written record.** Read `PROGRESS.md` in this folder (about 60 lines) and the open-items index. Do not assume the
   person in this session remembers earlier sessions or decisions; the files carry continuity, not memory.
2. **Open with three lines:** the goal sentence, the slice in progress, and the single next step.
3. **One slice at a time.** Finish it, or stop at a point where the app still runs. Do not start a second slice.
4. **New ideas are welcome and get parked.** When an idea comes up mid-slice (from anyone, including Claude),
   add a row to `docs/open-items.md` (status PARKED), say so, and return to the slice. Parking is not rejecting.
5. **Decisions come as short choices.** Offer two or three options with one recommended and one sentence of why.
   Never an open-ended "what would you like?".
6. **Use plain, literal wording.** Say what a thing does. No metaphor in instructions, labels, or summaries.
7. **Close every session with `handoff-writer` (replace, do not append, in `PROGRESS.md`):** what is done, what is half-done and where it stopped, the
   next step, and any decision made (with the date). Then say those four things in the chat.
8. **A decision already recorded stays decided** unless the user reopens it. Do not re-ask.
9. **Commit each slice once it is finished and tested** (the user asked for this on 2026-10-11). Run
   `pre-commit-check` first, stage only that slice's files, and keep changes to this folder in their own
   commit. Never push unless the user asks.

## The repo grows to fit the kit
The oracle kit was designed from the goal, and the repo has grown to hold it (what exists is listed in
`docs/archive/progress-history.md`, under "Slices"). Existing
tarot code is not a template and not a constraint: do not shrink, bend, or delay an oracle feature so that it
fits a table, route, component, or prompt that was written for tarot. Build what the kit needs; reuse an
existing piece only when it already does exactly the right thing.

Things written for tarot that must not be carried over by habit:
- the hardcoded deck and its stock meanings (`lib/cards.ts`)
- the Pixie-Smith reader voice in the AI prompts (`app/api/interpret`, `interview`, `insights/pattern`)
- stock text being sent to the AI (`lib/reading-context.ts`)
- the fixed 30% reversal rule (`app/api/draw/route.ts`)
- suits, concept graph, and esoteric associations as required card structure

House conventions still apply to new code: `add-migration` (schema), `new-api-route` (routes and pages),
`next16-docs` (framework), `pre-commit-check` (before committing).

## Scope
**In:** making, editing, and deleting personal cards; the user's own words for each card; card art the user
draws or uploads; pulling cards from their own deck; journaling on a pull; seeing how their own meanings change
over time; AI that asks questions; AI help with card art, only when the user asks for it (the form is chosen at
slice 3; see the 2026-10-11 decision in `DECISIONS.md`).

**Out, for now** (park these if they come up): sharing or selling decks, forum posts of decks, printing or
export, AI-written meanings, mixing oracle and tarot cards in one spread, importing published oracle decks.

**Wider direction (2026-10-11):** the user wants the app to teach divination with tools from all over the world:
Norse runes, ogham staves, pendulums, scrying surfaces, and more. That plan and its rules are under "Wider plan"
in `docs/archive/progress-history.md` (search it; do not read it whole). It does not change the oracle kit's goal sentence.

## Build order
Slices 0 to 7 (schema, a card with words, card art, a pull, journal and meaning history, the AI companion, Patterns) and tools T1 to T5 and later are built; the table and the answered slice-0 questions are in `docs/archive/progress-history.md` ("Oracle skill: build order and slice-0 questions"). What is built and what is next: `PROGRESS.md` and `docs/open-items.md`. The answers to the slice-0 questions are decisions in `DECISIONS.md` (2026-10-11): many decks, reversals off by default and set per deck, only a name required, several meanings per card, a pull is one card unless the person defines a layout.

## Design rules
1. **The user is the only author.** No card arrives with a built-in meaning. Empty fields stay empty until the
   user fills them. Never pre-fill from tarot, a concept list, or the AI.
2. **Their deck, their rules.** Deck size, card names, whether reversals exist, what fields a card has, and what
   counts as "finished" belong to the user. A one-card deck is a valid deck. If they know what they want, let
   them at it and help them develop their ideas. If they're unsure, help them explore and discover their own
   meanings. The app is not a teacher, it is a mirror and a sounding board.
3. **Ask before offering.** The AI's default output is a question. It gives an interpretation only when the user
   asks for one, and then builds it from the user's own words about that card.
4. **No right or wrong.** Never score, grade, or correct. No copy that implies a meaning was missed.
5. **Reflect, do not judge.** Compare the user's words now with the user's words before ("you wrote X in March
   and Y today"). The user decides whether a change is growth or noise. It is okay to show the user that their
   own meanings have changed over time, but never to say they were wrong. Meaning changes throughout a life.
6. **Keep history.** Changing a meaning adds a version; it does not erase the old one, unless the user deletes it.
7. **Everything can be edited, emptied, and deleted** by the user, including art, journal entries, and AI output.
8. **Adaptive behaviour is visible and can be switched off.** That covers AI prompts, tracking, and reminders.
9. **Private by default.** All oracle data is scoped by `user_id`. Nothing reaches the forum or another user
   unless the user explicitly posts it.
10. **Low friction, no pressure.** No streaks, no required fields beyond a name, no "incomplete deck" warnings.
    A card saved half-made is saved.

## Tarot and AI guidance
Merged on 2026-10-17 from the skill `intuition-feature-design`. These apply to the built-in Pixie-Smith deck (`lib/cards.ts`), card meanings, interpretations, insights, journals, and any AI help. The design rules above apply here too; where a tarot rule repeats one, the design rule's number is given.

The app exists to help people fine-tune *their own* intuition. It evolves with them. It does not tell them what cards mean: it is a collection of personal notes and interpretations that happens to contain a Pixie-Smith deck as an optional example.

1. **Predict, then reveal.** Where a feature shows a meaning or an AI interpretation, offer the person a chance to record their own impression first. The reveal is optional and comes after. (Stock Pixie-Smith information is shown only behind a button labelled "Pixie-Smith Meanings".)
2. **The person's meanings come first.** A card's meaning is *seeded* with the built-in text (upright and reversed, the concept graph, associations), but its growth is in the person's full control. Their personal associations and descriptions outrank built-in text in display order and in anything fed to the AI. Their own text is stored apart from, and shown above, the seeded text. (Design rule 1.)
3. **No right or wrong.** Never score a reading, mark an interpretation correct or incorrect, or imply a person "missed" the meaning. Built-in text is a starting point, not an answer key. (Design rule 4.)
4. **Track consistency against the person's own descriptions.** Measure how today's read resembles how they have described a card before, or whether the situation later matched what they wrote. Frame it as self-knowledge ("your Tower tends to mean..."), never as grades.
5. **Show growth, not judgment.** Surface patterns and drift in a person's own meanings over time in neutral language. They decide whether a change is evolution or noise. (Design rule 5.)
6. **Control.** Anything adaptive (prompts, AI voice, tracking) is visible, adjustable and switchable off. The AI offers questions and mirrors the person's language; it does not override their meaning. (Design rules 3 and 8.)
7. **Privacy by default.** Personal meanings and predictions are scoped by `user_id` and never reach the forum unless the person posts them. (Design rule 9.)

Relevant code: `lib/cards.ts` (stock meanings), `lib/reading-context.ts` (what the AI is given), `app/insights`, journals, the encyclopedia concept graph, and `card_customizations` (migration 005). For the AI companion's data path, run `companion-privacy-audit`. For wording, run `copy-check`.

## Review checklist
Answer each with evidence from the diff. Any "no" (or "yes" on question 2) stops the work until it is fixed.

1. Does the feature serve the goal sentence, and is it part of the current slice?
2. Does any screen, default value, or AI prompt put a meaning in front of the user that they did not write?
3. Is the user's own text what the AI receives, with no tarot stock text mixed in?
4. Could any wording read as "you were wrong" or "you are behind"?
5. Can the user edit, empty, and delete every piece of data this feature stores?
6. Is every query scoped by `session.userId`, and does every new table cascade on user delete?
7. If existing tarot code was changed, was that change deliberate and named in the summary?
8. Are `PROGRESS.md` and `docs/open-items.md` true?
9. For tarot and AI features: does it ask for the person's view before showing ours? Is their text stored apart from and shown above the seeded text? Does the AI prompt include their own descriptions (`lib/reading-context.ts`) and not only stock text? Can they edit and delete everything it records?
