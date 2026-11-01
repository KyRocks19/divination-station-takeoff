---
name: open-item-sync
description: Keep docs/open-items.md the one current list, verify items against the code, regenerate the index. Use when asked what is open, after a slice (quick), before handoff-writer.
---

# Open-item sync

**The hazard:** a finished item still shown as open wastes a session; a built feature nobody recorded gets built twice. The code is the judge; `docs/open-items.md` is the one list; `docs/open-items-index.md` is its generated one-line-per-item view.

Arguments: `quick` (default): only the items whose files changed since the last sync (`git diff --stat <commit named at the top of open-items.md>..HEAD`), and the items the slice just touched. `full`: every document below; use it before a release or when asked, not at the end of every slice.

## Steps
1. **Ground truth.** `git status`, `git branch --show-current`, `git log --oneline -15`. Work can be finished on another branch: `git branch --contains <commit>` or `git log --all --oneline -S"<symbol>"` before calling anything missing.
2. **Verify each item you touch in the code** and record one line of evidence (a path, or the search that found nothing): a route or page → the file exists and exports the method; a screen → the component exists **and** a page renders it; a data change → the migration file exists (dev: read-only `schema_migrations` query on `ep-your-dev-branch` only; live: say "owed, unverified"); a decision to build → search for its first-named symbol. Classify: `OPEN`, `DONE`, `PARTIAL` (say what is left), `BUILT-NOT-LIVE`, `DECISION`, `HUMAN`, `UNVERIFIABLE`.
3. **Edit `docs/open-items.md`.** `DONE`: remove the row (no Done log; the ID is retired and never reused). New work gets an unused ID, one row, a first sentence that says what the item is (the index shows it). Keep the detail in the row, but put long history in the relevant doc and point to it. Correct stale facts; delete sentences that are no longer true instead of adding "(now changed)". Update the "Synced" line only for facts you checked.
4. **Regenerate the index:** `npx tsx scripts/open-items-index.ts`. `npm test` fails if the index is stale or an ID appears twice.
5. **`full` only:** also Grep (do not read whole) these for "open|owed|parked|not built|TODO": `PROGRESS.md` (now short), `DECISIONS.md` (append a status note only; never change a recorded decision), `docs/handoff-*.md`, `docs/security-audit.md`, `docs/design-system.md` ("Known gaps"), `README.md`, other skills' "not started" sentences, code `TODO`/`FIXME`. Replace duplicate backlog text with "see `docs/open-items.md` <ID>". Never edit `docs/archive/*`.
6. **Commit** the document changes apart from code; name the files; message in a file. Never push.

## Rules
- Evidence beats prose; where a document and the code disagree, the code wins.
- Do not decide for the user: items that need a choice go in section C with a default. Do not start building.
- Do not mark anything done because it was built on a branch that is not this one: mark it `BUILT-NOT-LIVE` and name the branch.
- Reading task: no migrations, no servers, no full test run (the index test is the exception, run by `pre-commit-check`).
- Plain, literal wording (design rule 6).

## Report in chat
Counts by status; items that flipped (ID, old, new, evidence); documents changed; items waiting for the user; what could not be checked. Short.
