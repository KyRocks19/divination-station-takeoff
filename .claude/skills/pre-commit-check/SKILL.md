---
name: pre-commit-check
description: Verify a change before committing (or a branch before a push, with `push`): names the checks that apply, runs tsc, tests, build and a secret scan.
---

# Pre-commit check

Usage: `/pre-commit-check` (the change in front of you) or `/pre-commit-check push` (the full run before a branch is pushed). During the work run only `npx tsc --noEmit` and the test file for the area (`before-you-code`, section 7).

## 1. Which other checks apply (one command, not a table to read)
`npx tsx scripts/changed-checks.ts` (for `push`: `npx tsx scripts/changed-checks.ts origin/main`, or the branch's upstream). It prints the checks this change needs, with the files that triggered each, and runs the secret scan (keys, database addresses with a password, `.env*`, `*.swp`, `tarot.db`). Any secret finding stops the commit. Load **only** the skills it names, and only the ones whose subject you actually changed; say in the report which you ran. Two things it cannot see: click-test anything a person can click with `test-as-user` (touch and screen readers cannot be checked there; say so); a change to what is stored or sent needs `data-lifecycle-check` even if no migration changed.

## 2. Typecheck, tests, build
- `npx tsc --noEmit` must be clean (in a cloud session run `npx next typegen` once first).
- `npm test`: quote the pass count. It includes the guards (sign-in check in every handler, no inline styles, the companion's import limits, privacy and export rules, `docs/open-items-index.md` being current).
- `npm run build`: catches Next 16 errors that `tsc` misses. Skip only for docs-only changes, and say so.

## 3. Stage and commit
Name the files; no broad `git add` (the repo has untracked data files). One finished, checked slice per commit; notes and docs in their own commit. Message in a file, `git commit -F`. Do not commit if section 2 fails. Never push unless asked.

## 4. Report
The checks from section 1 and what each found; the section 2 results with the actual output of any failure; what was not checked (NVDA, a real phone, a database without the new migration).

## 5. Ready to push (`push` mode only)
Stop at the first failure and say what it is.
1. `git status --short` is empty (list anything uncommitted and say it stays behind).
2. Sections 1 and 2 passed over the whole branch; quote the test count and the build result.
3. Run `live-migration-check` (read-only): migrations the branch adds that live lacks, and which code needs them first. Code that tolerates a missing migration (`42P01`/`42703`) can go first.
4. Run `open-item-sync quick`; the notes are committed apart from the code.
5. `git fetch origin`, then `git rev-list --left-right --count origin/<branch>...HEAD`. Commits on the remote that are not here mean the branch diverged: say so and stop; never suggest `--force`.
6. Print: the branch and how many commits are not on the remote; what must run on live first; what was not checked; and the command alone in a `bash` block (`git push origin <branch>`, or `git push -u origin <branch>` with no upstream). A push does not merge into `main`, and whether it deploys is not known from the repository. Push it yourself only if the user asked; the hook asks them to confirm.
