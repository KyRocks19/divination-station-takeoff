# Release plan: the cheapest route to a public release

Written 2026-10-22 (cloud session, branch `claude/clever-hamilton-1zzdgw`). It is a recommendation for the owner to accept, change or reject; nothing here is decided. Open work itself stays in `docs/open-items.md` (index: `docs/open-items-index.md`); this file only orders it and says how to spend effort on it.

**What was checked:** the project documents, all 21 project skills, the open-items table, `npm test` (813 pass), `tsc` (clean after `npx next typegen`). **What was not:** the feature code itself (the lanes below are sorted from the open-items rows and their evidence, not from reading each feature), `npm run build`, any browser, the live database. Token figures are bytes divided by 4, so they are estimates.

## 1. The finding in three lines
1. Almost everything still open for a public release is **not code**: it is owner decisions, owner-run steps, legal and provenance answers, and checks on real devices. Code written for those costs tokens and cannot finish them.
2. The code that does matter for release is small, and most of it is verification (tests, scans, one smoke harness), not features.
3. The app already has far more features than the checks behind them (most of the 2026-10-20 and 10-21 work was never opened in a browser). **More features before release add risk faster than value.** Freeze features; spend the budget on proof.

## 2. Where tokens were going, and what changed today
A session start used to read about 117 KB (about 29,000 tokens) before any work; every later turn in that session re-read it from cache.

| Read at session start | Before | After |
|---|---|---|
| `PROGRESS.md` handoff (dated paragraphs, appended every session) | 57 KB (lines 1 to 91) | 6.6 KB, rule: replace, never append, under 70 lines |
| `docs/open-items.md` (rows of up to 2 KB each) | 31 KB | 9 KB index (`docs/open-items-index.md`, generated); Grep an ID for its row |
| `oracle-feature-design` skill (answered slice-0 questions, build table) | 13.6 KB, always | 10.9 KB, and only for oracle, tool, meaning or AI work |
| `pre-commit-check` (a table the model reasoned over) | 6.2 KB | 3.2 KB plus `scripts/changed-checks.ts`, which prints the checks that apply and scans for secrets |
| `open-item-sync` | 6.4 KB, `full` by default | 3.4 KB, `quick` by default |
| `handoff-writer` | 3.6 KB, told sessions to append | 3.0 KB, told to replace |
| 21 skill descriptions (in every session's prompt) | about 6.5 KB | about 3.8 KB |

Net: roughly 21,000 fewer tokens at the start of each session, and about 10,000 fewer when the end-of-slice checks run. Nothing was deleted: the removed text is in `docs/archive/progress-history.md`, last section.

## 3. The lanes (what to do, in what order)

### Lane 0: owner-gated. Start these now, they are the slowest and cost no tokens
| ID | What | Why it comes first |
|---|---|---|
| ED20 | Felix G's written agreement to AGPL v3 and the credit line for the shared text and spreadsheets | Blocks any download release; waits on a person |
| ED18 | Provenance answers (who wrote the tarot descriptions, "St. Cepesa Horat", card image release countries, favicon) | Blocks any download release |
| O1 | Live migrations 088, 089, 090 (`live-migration-check` prints the order) | Code runs without them, features do not |
| O7 | Rotate both Anthropic keys by 2026-11-12 | Dated |
| O11 | Spend limits at Anthropic, Neon, Upstash | A public hosted release has no ceiling without them |
| O14, then O13 | Make the reference bundle on your computer, then publish on itch.io | O13 waits on ED18 and ED20 |
| H2.0 | The two-Tailscale-account test in `docs/host-mode-tailscale-test.md` | Decides whether host mode is built at all (H2.2 to H2.6 are on hold until it is answered) |

### Lane 1: release-blocking, and cheap. Build in this order, in one or two sessions

**Status 2026-10-22 (branch `claude/project-thread-k2xdnp`):** items 1 (history scan: no secrets), 2 (tested on PGlite; dev and live runs are the owner's), 3 (drafted as three texts, local, host and hosted; awaits the owner's wording pass), 4 (it found and fixed a real gap: the proxy's policy replaced the sandbox one), 5 (every theme and the default pass) and 6 (`scripts/smoke-pages.mts`: 3 bugs found and fixed, then 73 pages clean on a local and a host copy) are done; 8 is done apart from moving a backup between computers. 7 (crisis wording) is the owner's review. **Changed by the owner the same day:** Circles and host forums are in the first release, for technical hosts (`docs/host-guide.md`), so H2.0 moves to Lane 0 and H2.4/H2.5 are done as drafts.
1. **ED12, the history scan** (tokens: low). A script that greps every commit for keys, database addresses, tokens and `.env` names, and a list of personal files to remove from a public copy. The new `scripts/changed-checks.ts` secret patterns can be reused over `git log -p`. The security review and the privacy and terms wording are separate steps that need the owner's approval.
2. **ED21 tier 2 test** (low). Written, never run. Run `scripts/apply-concept-wording.ts` on dev, `tsc`, tests. A released app should not carry untested wording changes to sensitive concepts.
3. **One privacy-notice paragraph for all the new stored writing** (low code, owner decides the words): guesses (GF1c), the four small tools (NT1), blots (T10b), blind-target facts. Changing the notice makes everyone read it again, so do it once, in the release, not four times.
4. **E9, the CSP regression test** (low). Assert that a gallery and a card-art response carry both policies.
5. **T9b, dark-theme contrast** (low, mechanical). The test already prints the failing pairs; fix the tokens until it prints none.
6. **The smoke harness** (medium, once; see section 4, tactic 1). It replaces most of Lane 3's device-free checks and every later ad hoc browser run.
7. **Crisis wording (O9)**: the draft is written and unreviewed. Self-harm words are near the sensitive concepts, so a person-reviewed link to crisis help should be in the release. Owner review, not code.
8. **ED9 leftovers that a stranger will hit** (medium): the message for a locked data folder, and a backup before an update. Skip replace-style restore (ED6) for v1; add-only import exists.

### Lane 2: one device day (owner time, almost no tokens)
Group every CHECK and OWNER-run item into a single checklist and do them in one sitting: ED10 (Windows folder on a clean machine, SmartScreen), the Mac folders, Linux arm64, F2, E4, E7, E8, E10, E11, F1 (NVDA, a real phone, VoiceOver or TalkBack). A session can write the checklist as one page with the exact click path for each; running it is the owner's. Findings come back as a short list, and only the failures cost tokens.

### Lane 3: defer past v1 (record, do not build)
X4a/X4b parity work, BIB1, NT1 extras, R1/R8 (also waits on the owner's review of the tarot archetype draft), T4b/T4d, T18, T15 (unless the smoke harness shows it badly broken), S10 passkeys (built after all on 2026-10-22, owner's choice; migration 093), ED13 young-folk mode (see the question below), P1, PIC1, P3b, X1 to X3, Q5, T9/T11/T12/T17b, ED14, Y17, O12, H2.2 to H2.6, I1 extras, L1 traditions.

**One question for the owner, because it changes Lane 1:** ED13 (young-folk mode) and ED17 (no age floor) together mean the public local edition may be used by children with no age statement. Is v1 shipped with plain "made for adults and teenagers, no accounts, nothing leaves the device" wording (cheap), or does it wait for the mode (a real build)? A recommendation: ship the wording, because the local edition has no accounts and sends nothing, and build the mode after.

## 4. How to build (and check) with fewer tokens
1. **Build one smoke harness, once** (`scripts/smoke-pages.mts`, using the pre-installed Chromium): start the local edition on an embedded database, make an account at `/setup`, visit every page in `lib/nav-groups.ts` plus the tools' detail pages at 390 and 1280 px, record console errors, sideways scroll and axe results, print a table. Every slice today ends with a hand-written browser script (a repeated cost visible throughout the old session notes). The harness makes "did this break anything" a 20-line report. Add `@axe-core/playwright` as a dev dependency. Expected effort: one medium session.
2. **Turn recurring greps into tests.** Already tests: sign-in check, no inline styles, import limits, the `GuessFirst` list. Candidates: raw hex or `purple-N` in `components/` (design-system-check), a bare `×` or small `Button variant="text"` without `min-h-6`, words the copy rules forbid ("we", "wrong", "correct" in labels), every stored table named in the export (data-lifecycle-check). A test costs tokens once; a skill that asks the model to grep costs them every time.
3. **Check by diff.** `npx tsx scripts/changed-checks.ts` names the checks; load those only. Run `pre-commit-check push` once per batch of slices, not per slice.
4. **Batch slices that share files, study once.** Lane 1 items 2 to 5 touch different small files and need no study; do them in one session. Do not run `app-study normal` for a task in an area whose sibling you already read.
5. **Match the model to the slice.** Design, privacy, legal or tradition wording (`copy-check`, `write-ritual-source`, `companion-privacy-audit`, `data-lifecycle-check`): the strongest model. Routine slices, tests, docs, index and notes: a mid-size model. Mechanical sweeps (renames, grep reports, the index): the smallest. A sub-agent starts cold, so use one only for a read-only sweep of more than about 30 files.
6. **Keep rows short.** A row in `docs/open-items.md` that needs 2 KB of history (ED21, GF1, NT1, ED10, H2) belongs in a doc, with the row pointing at it. The index shows only the first sentence.
7. **End a session at a slice boundary.** A fresh session now starts with about 8,000 tokens of project documents; a long one carries its whole history into every turn. Prefer three short sessions to one 150,000-token one.
8. **Report in 15 lines.** The checks run, the counts, what was not checked. Do not re-read a file just edited.

## 5. Suggested sequence
| Session | Content | Needs from the owner |
|---|---|---|
| 1 | Lane 1 items 1 to 5 | Approve the privacy-notice words (item 3) |
| 2 | Lane 1 item 6, the smoke harness; fix what it finds | none |
| 3 | Lane 1 item 8 and the device-day checklist (Lane 2) | none |
| Owner | Lane 0 in parallel from today; the device day | Everything in Lane 0 |
| 4 | Release candidate: `pre-commit-check push`, packaging, reference bundle, ED12 pass | Lane 0 answered |
| After | Lane 3, in the owner's order, plus the ideas below | |

## 6. Enhancement ideas (the owner chose all nine on 2026-10-22; all are built, see IN1 in `docs/open-items.md`)
They are ordered by how directly they serve "help people fine-tune their own intuition" and stay inside the design rules (no scoring of meanings, nothing hidden, everything deletable, psi never asserted or dismissed).

1. **Confidence beside the guess (small).** "Write what you sense first" already stores the guess and a later 1 to 5 fit. Add an optional "how sure am I" (1 to 5) at the moment of writing. Patterns can then show, in plain counts, "when you felt very sure, it fitted 5 of 9 times; when unsure, 4 of 14". This is the one measure that teaches intuition, because it separates a feeling of certainty from being right. Opt-in, shown with the number of readings behind it, never a grade.
2. **A look-back for every reading, not only predictions (small).** The day page already nudges predictions. Offer, per reading, one gentle prompt after a week or a month: "What happened with this?", stored against the guess. It is how a guess ever gets checked.
3. **Conditions notes with honest numbers (medium).** An optional private tag per reading (rested, rushed, calm, after a walk). Patterns shows the fit by tag with sample sizes and the chance baseline the blind-target tool already computes, and says plainly when there are too few readings to say anything.
4. **Practice mode for tarot, like blind-target (medium).** A sealed card the person guesses (suit, number, or a feeling word) before it is shown, with a hit rate beside chance. It trains the same loop the other tools do, with immediate feedback, and the sealed-target code exists.
5. **One question, several tools (medium).** Let a person link readings from different tools to one question, then show their own guesses side by side, "tarot said, runes said, pendulum said", in their words only. Disagreement between tools is where people learn what each tool means to them.
6. **A "what would change my mind?" question from the companion (small).** The companion asks questions only; add one standing question to its set that asks the person what outcome would show their reading wrong. It supports honesty about intuition without the app judging anything.
7. **Sample data, clearly marked and removable (small to medium).** Patterns, look-backs and the world map are empty for a new person, and they are the app's best feature. A "show me with example data" switch (clearly labelled, in a separate account state, deleted with one button) shows a visitor or a reviewer what 30 days of use looks like.
8. **A yearly review as a Markdown file (medium).** Built from the person's own words: cards or runes that recurred, meanings that shifted, guesses that fitted, written as their own timeline and kept on their device. It is a shareable output that needs no server.
9. **A three-way first screen for the local edition (small).** The first run screen could offer three routes in one line each: "try a reading", "make my own cards", "bring my data from a backup". Today the choice is in the navigation.

Risks to settle before any of 1 to 5: the wording must say that matching a guess is not proof of anything, in either direction; small samples must be labelled as small; and each needs the data-lifecycle and companion-privacy checks, since it stores more of the person's writing.
