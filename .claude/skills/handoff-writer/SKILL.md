---
name: handoff-writer
description: Close a session: replace (not append to) the Handoff summary in PROGRESS.md, sync open items, commit notes apart from code. Use when wrapping up.
---

# Handoff writer

The user is neurodivergent and plural; written continuity is how they and later Claudes find their place. A handoff must be short, current and findable. **Stale and bloated documents are the main hazard**: PROGRESS.md grew to 95 KB (about 24,000 tokens read at the start of every session) by appending a dated paragraph per session, and was cut to 6 KB on 2026-10-22. Do not let it grow back.

## Where things go
- **Current state:** the "Handoff summary" in `.claude/skills/oracle-feature-design/PROGRESS.md`. **Replace its lines; never append a dated paragraph. Keep the file under 70 lines.**
- **Lessons and per-session detail** (what was built, branch names, commit ranges, test accounts, what was checked): `docs/archive/progress-history.md`, as one short dated block at its end. Commit messages hold the rest. Nothing in it is read at session start.
- **Open work:** `docs/open-items.md` only (see `open-item-sync`). Do not retype it in the handoff.
- **Next piece of work:** a `docs/handoff-<topic>.md` only when the next session needs a brief longer than a few lines; retire it (move to `docs/archive/`) when the work is done.
- **Reference docs that are still true:** `docs/`. **Finished or superseded documents:** `docs/archive/` with `git mv`, one line in `docs/archive/README.md`, and every link fixed (`grep -rn "old-name" --include=*.md --include=*.ts --include=*.tsx . --exclude-dir=node_modules`).

## Steps
1. **Facts from the repo, not memory:** `git status`, `git log --oneline -10`, the `npm test` count, whether `tsc` and the build pass, the highest file in `migrations/`. Never write "passing" without running it.
2. **Edit the Handoff summary in place:** fix the numbers that changed (next migration, test count, what is owed on live, what was never click-tested), add one line to "Last things built" and drop the oldest. Delete sentences that are no longer true.
3. **Working notes:** add a line only for a lesson that was costly to learn and is not obvious from code. If it belongs in a skill, put it there and not in the notes.
4. **Archive block** (only if there is something a future session might Grep for): date, branch, what was built, what was not checked, lessons.
5. **Memory:** a durable preference or fact the user gave goes in the memory files; do not duplicate repo content.
6. **Run `open-item-sync quick`** on what you changed, then `npx tsx scripts/open-items-index.ts` if it did not.
7. **Commit** notes and docs apart from code; name the files; message in a file with `git commit -F`; end with the Co-Authored-By line the session specifies. **Never push** unless asked.
8. **Say it in chat:** what is done, what is half-done and where it stopped, the next step, decisions made, and the sync's counts.
