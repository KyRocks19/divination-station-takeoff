---
name: before-you-code
description: Facts every session otherwise re-learns (which machine, the two databases, Next.js 16, what may reach the browser, sign-in check, no inline styles, tokens, testing, commits). Load before the first edit.
---

# Before you code

Read this once per session, before the first edit. It is short on purpose: each line is a thing a session has lost time on. It points to the deeper skill where there is one. If this file and the code disagree, the code wins; fix this file.

Order: a big or unfamiliar area → `app-study` first. Then this. Then code. Then `pre-commit-check` (it names the other checks that apply).

## 0. Which machine (check `uname`; a cloud session is Linux in a container, the owner's PC is Windows)
- **Cloud session (Linux):** no `.env*` files, no Neon address, no NVDA, no Windows paths; skip section 1 except the heredoc rule. First run `npm ci` (about 1 minute), then `npx next typegen` once (without it `tsc` reports `RouteContext` errors that are not real). Then `npx tsc --noEmit` (clean), `npm test` (813 tests, about 40 s the first time), `npx tsx --test tests/x.test.ts` for one file. A browser run: `DS_EDITION=local DS_DB_DIR=<scratch folder> SESSION_SECRET=<any 32+ characters> npm run build`, then `npx next start -p 3101` (make the account at `/setup`); the embedded database applies every migration, so a migration can be checked here without a Neon branch. Chromium and Playwright are pre-installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; use `executablePath: '/opt/pw-browsers/chromium'`; do not run `playwright install`). Stop a server you started by its PID (`pkill -f next-server` has ended the shell). The owner runs live migrations, seeds and the reference bundle on their computer.
- **The owner's PC (Windows):** section 1 applies.
- **Check what changed, not everything:** `npx tsx scripts/changed-checks.ts` lists the checks this change needs (it replaces re-reading the table in `pre-commit-check`) and scans for secrets.

## 1. The owner's PC (Windows 11, Git Bash for the Bash tool, PowerShell too)
- Node, `npx tsx` and `npm` work in the Bash tool here. Prefer the dedicated tools (Read, Edit, Write, Grep, Glob) to shell file work.
- **Never use a heredoc (`<<`) in the Bash tool, whatever its size.** Whether one fails cannot be predicted (on 2026-10-18 six plain ones worked and the seventh, with apostrophes in its text, failed), so there is no safe kind. A hook (`guard-bash.mjs heredoc`) now refuses one in the Bash tool. A heredoc with an apostrophe fails with "unexpected EOF", and a backslash in one is eaten (`"\\%"` arrives as `"\%"`). Write files and edit scripts with the Write tool (a small `.py` in the scratchpad that reads, replaces with an `assert old in s`, and writes), then run them. Write test text containing backslashes with the Edit tool.
- Git Bash turns an argument that starts with `/` into a Windows path (`/privacy` became `C:/Program Files/Git/privacy`). Pass `privacy`, or build the path inside the script.
- `console.log("%s…")`: a first argument containing `%` is a format string. Use `process.stdout.write` to print patterns.
- A script that uses top-level `await` must be `.mts` (a `.ts` one fails with "Top-level await is not supported with cjs"). Put throwaway scripts in the project root so imports resolve, run with `npx tsx`, and **delete them**. Never leave a script with a database address behind.
- Git prints "LF will be replaced by CRLF" warnings on every add. They are harmless.
- Do not run whole-disk searches. Do not print `.env*` values.

## 2. Two databases (the costly mistake of 2026-10-13)
- `ep-your-dev-branch` and `ep-your-live-db` in these skills stand for the real hosts: the dev one is in `.env.development.local`, the live one in `.env.local`. Compare against those files, never against the placeholder.
- `npm run dev` reads the Neon **dev branch** (`.env.development.local`, host starts `ep-your-dev-branch`). `npm run build`, `npm start` and every script/`npm run migrate` read **live** (`.env.local`, host `ep-your-live-db`).
- To aim a script or migration at dev: `export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"`, print only the host (`sed -E 's#.*@([^/:?]+).*#\1#'`), and stop unless it starts `ep-your-dev-branch`. Do this in the same command as the script. The guard hook refuses a migration, restore or seed aimed at live; do not look for a way round it.
- **The user runs live migrations and live seeds.** So new code must work before its migration is on live: treat Postgres `42P01` (no table) and `42703` (no column) as "feature not there yet" (catch the code, return an empty or off state, rethrow anything else). Say in your report which migrations are owed. Once the owner says a migration is on live, take its guard out again: every edition applies all migrations on startup, so a guard on a live migration only hides real errors (all guards up to 097 were removed on 2026-10-26).
- Migrations: `ls migrations | tail`, next number = highest + 1; idempotent (`IF NOT EXISTS`); additive; dev first. `add-migration` has the rest, `live-migration-check` lists what live is owed.
- Query only through `query`, `queryOne`, `withTransaction` from `lib/db.ts` (retries, error handling). Parameterised `$1…` only.

## 3. Next.js 16 is not the one you know
- Read `node_modules/next/dist/docs/` for anything in `app/`, `proxy.ts` or `next.config.ts` (`next16-docs`). `proxy.ts` replaces `middleware.ts`; `cookies()`, `headers()`, `params` and `searchParams` are Promises: `await` them.
- **Every page must stay dynamic.** The root layout reads the session cookie and `proxy.ts` sets a per-request nonce for the page policy (`lib/csp.ts`). Do not add `export const dynamic = "force-static"`, `generateStaticParams`, or `revalidate` to a page.
- **Never write `style={...}`.** Production refuses style attributes and `tests/no-inline-style.test.ts` fails. Use a class, `styleRef`, `<Styled css={…}>` or `FillImage` (`docs/design-system.md`, rule 5).

## 4. What may reach the browser
- A `"use client"` file may import only pure files. Split every feature three ways: `lib/x-core.ts` or `x-shared.ts` (no database, no tarot deck; the browser and the tests use it), `lib/x.ts` (SQL, server only), the route and the component. `client-safety-check` has the grep.
- Guard tests pin some import lists exactly (`tests/nav-groups.test.ts` pins what `SiteSearch.tsx` and the nav may import; `tests/recent-searches-core.test.ts` and `tests/hidden-links-core.test.ts` pin their `-core` files). When a guard fails because you added a deliberate import, update the pinned list in the same change and say why; do not loosen the check.
- `localStorage`/`sessionStorage`: every read and write in try/catch. No first render that depends on the browser (time, locale, `window`).
- A change to the session or what the layout shows needs `window.location.assign`, not `router.push`.

## 5. API routes (`new-api-route` has the template)
- **Write the sign-in check inside every handler**: `const session = await getSession(); if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });`. A shared helper is not recognised by `tests/route-auth.test.ts`. Admin-only: also `if (!session.isAdmin)` → 403.
- Scope every query by `session.userId`, including `UPDATE`/`DELETE` on `[id]` routes. A test that creates a second person's identical data catches leaks; do that when the route returns writing.
- Every POST/PUT/PATCH/DELETE counts toward a per-person write limit in `proxy.ts`; a route that only reads but needs a POST body (search) is added to `READS_BY_POST` there. Scripts that call write routes must send an `Origin` header equal to the site's origin.
- Admin actions are recorded: `logAdminAction(session, action, …)` with the action added to `lib/admin-log-core.ts` (`ADMIN_ACTIONS` and the words).

## 6. Look and wording
- Colours are tokens, never hex or `purple-N`: `bg-surface`, `text-ink-muted`, `border-line`, `text-tone-500`, links `text-accent-ink hover:text-accent-ink-hover`. Use the pieces in `components/ui/` (`Button`, `Field`/`Input`/`Select`/`Textarea`, `Card`, `Page`, `Tile`); copy `fieldClass`, never its string.
- Targets: 44 px on a phone (the base layer in `app/globals.css` and `min-h-11` in the pieces), and at least 24 px at every width: a small `Button variant="text"` or a bare `×` needs `min-h-6` (axe `target-size` flags it).
- Words a person reads: plain, literal, the person is the author, no metaphor, no "we"; never assert psi as proven or dismiss it; "old" is not "better". `copy-check`. Anything a tradition says: `write-ritual-source`.
- Stock text is optional and behind a button ("Traditional Meanings"); the person's own words come first.

## 7. Tests and checking (all fast on this machine: `tsc` 6 s, all tests 5 s, one test file 1 s, `npm run build` 12 s)
- After each edit: `npx tsc --noEmit` and the test file for the area (`npx tsx --test tests/x.test.ts`). The tests have no database; they test pure files, and about 28 test files also read files from the repo as guards (imports, sign-in checks, no inline styles, migrations). Add a test with each new data file, helper and migration.
- A change that works only with data (SQL, counts, privacy) needs a real run against the dev branch: a throwaway `.mts` that seeds rows for a test account and a second one, calls the function, and prints. Check that person B's identical words never reach person A.
- A browser check: `npm run build`, then `next start -p 3101` with `DATABASE_URL` exported from the dev branch (as in §2). `npm run dev` under headless Chrome reloaded pages in a loop on 2026-10-17 (even `/privacy`), so do not test that way. Playwright and axe are installed once in `C:\Users\you\projects\test-tools`, outside the repo; do not install them again (`test-as-user`). Stop only servers you started.
- Order a browser test so the snapshot of shared data is taken first and any "not an admin" refusal is checked before the account is promoted (a test once changed a real piece because the account had already become admin).
- Match elements by role and accessible name, scoped to their container (`getByLabel("Side")` also matched a filter higher on the page).

## 8. Commits (push only when asked)
- One finished, checked slice per commit; notes in their own commit. Stage files by name. Write the message to a file (`printf '%s\n' … > "$TEMP/msg.txt"`) and `git commit -F`; end with the `Co-Authored-By` line the session's system reminder gives.
- **`git push` is a question** (hook plus ask rule; it was a hard block from 2026-10-17 until the user's decision of 2026-10-22). Never push unless the user asks. When commits are ready, run `pre-commit-check push`: it checks the whole branch and ends with the branch and the exact command. Push it yourself only if the user has asked you to; the prompt is theirs to answer.

## 9. Before you say it is done
`pre-commit-check` → the checks it names (`design-system-check`, `accessibility-pass`, `client-safety-check`, `copy-check`, `data-lifecycle-check` for anything stored, `companion-privacy-audit` for anything the person's words could reach). Report what you checked and what you did not (NVDA, a real phone, a database without the new migration).
