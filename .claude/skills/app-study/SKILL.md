---
name: app-study
description: Study the app (short cited map, the code the task touches) before a large, vague, cross-cutting or unfamiliar task; states what was and was not read, then does the task.
---

# App study

Nobody can hold this whole app in view at once (more than 130 API routes, 60+ migrations, dozens of tools and screens). So "understand all of it" means something exact here: **a layered, cited understanding, built from the code and stopped when the next layer would not change the plan**, then the user's task.

Usage: `/app-study [quick|normal|full] <the task>`.
- `quick` (about 10 to 15 reads): a small, local task, or any task in an area `docs/app-map.md` already covers and you have read a sibling of. `normal` (default, about 25 to 40): a feature in an area you have not read. `full`: an audit, a redesign, or "how does this app work?"; every area in the map is read. Pick the lowest depth that fits; each extra read is paid for again on every later turn.
- Everything after the optional depth word is the task (`$ARGUMENTS`). With no task, study, give the brief, and ask what to do next.
- Study is **read-only**: no edits, no dev server, no migrations, no full test run.

## 1. The rules and the state (always)
- `AGENTS.md` (loaded already) and `.claude/skills/oracle-feature-design/PROGRESS.md` (about 60 lines; read it whole).
- `docs/open-items-index.md`: note the IDs that touch the task, then `Grep` each ID in `docs/open-items.md` for its full row. Do not read that file whole.
- `DECISIONS.md`: `Grep` it for 3 or 4 words from the task. A recorded decision stays decided; quote its date.
- If the task is about the oracle kit, the pendulum, other tools, tarot meanings or AI help: also read the `oracle-feature-design` rules (design rules 1 to 10) and its "Tarot and AI guidance" section for tarot, meanings or AI help.
- Ground truth: `git status`, `git branch --show-current`, `git log --oneline -10`.

## 2. The map (once; refreshed, not rebuilt)
- If `docs/app-map.md` exists, read its header ("Studied at commit …"). Run `git diff --stat <that commit>..HEAD` and re-read only the areas that changed. If it does not exist, build it (below) and save it with that header.
- Build it from: `ls` of `app`, `app/api`, `lib`, `components`, `migrations`, `tests`, `scripts`, `docs`; `lib/nav-groups.ts` (the product, as the person sees it); `package.json`; `proxy.ts`; `app/layout.tsx`; `next.config.ts`; `lib/db.ts`, `lib/session.ts`, `lib/auth.ts`; a `Grep` of `CREATE TABLE` across `migrations/` for the data model.
- The map is one line per area: what it is for, its page, its API routes, its `lib` files, its tables, its tests. It also lists the **rules that apply everywhere**: a sign-in check in every handler; every query scoped by `user_id`; two databases (dev branch `ep-your-dev-branch`, live `ep-your-live-db`); migrations show-then-run; design tokens, not hex colours; plain literal wording; the companion sees only the person's own words; nothing is pushed unless asked.
- `full` reads, for each area in the map, its page, its main component, one API route, its `lib` file and its tests.

## 3. The task, in depth
1. Pick 3 to 6 search terms from the task. `Grep` and `Glob` for them; list the files that come up.
2. Read **fully**: every file you expect to change; what calls them and what they call; their tests; the migration that made their tables.
3. Read **one sibling feature** that already does something close, as the pattern to copy (the way a card page is copied from a rune page).
4. Follow the data: screen, API route, `lib`, SQL, and then the places in this app that usually need to change together: the Settings export (`app/api/export`, `lib/export-*.ts`), account deletion and its cascade, `lib/backup-format.ts`, search (`lib/search.ts`), the companion (`lib/companion-*.ts`; run `companion-privacy-audit` if the person's words could reach it), the navigation (`lib/nav-groups.ts`), the design system, tests, `docs/`, `lib/sources.ts` for anything that states what a tradition says.
5. Where a document and the code disagree, the code wins. Write the disagreement down for `open-item-sync`; do not fix documents during study.
6. A broad sweep over more than about 30 files may use read-only `Explore` agents, one per area, only if the user has allowed agents in this session. Otherwise do it yourself, narrower.

## 4. The brief (before acting; at most about 30 lines)
Say it in this order, marking each line **Read**, **Inferred** or **Not checked**:
- **The task in my words**, and the goal it serves (the person is the only author; the app is a mirror).
- **Where it lands:** the files, and the sibling I will copy.
- **Rules in force:** the design rules, decisions (with dates) and project skills that apply.
- **Ripples:** what else must change with it.
- **Related open items:** the IDs from `docs/open-items.md`.
- **Unknowns and risks:** what I could not confirm, and what could go wrong (data, privacy, the live database).
- **Plan:** the slices, in order, small enough that the app still runs after each.

## 5. Then do the task
Follow the project's recipes: `new-api-route`, `add-migration`, `next16-docs` (read the bundled docs before routing or config code), `client-safety-check`, `design-system-check`, `accessibility-pass`, `pre-commit-check`, `test-as-user`. Commit each finished, tested slice; never push.

**Stop and ask first** only when the brief finds a clash with a recorded decision or rule, or a guess that would be costly if wrong. Ask as two or three short choices with a recommendation (design rule 5), never open-ended.

## Limits to say out loud
Say what was not read. Do not claim to have "understood the whole app": say which areas were read, which were mapped only from file names, and which were not looked at. When the study found nothing that changes the plan, say so in one line instead of a long brief.
