---
name: data-lifecycle-check
description: Check a new table, column or stored text is covered by owner scoping, deletion, export, search, the companion and the privacy notice. Use after a migration or any change to what is stored or sent.
---

# Data lifecycle check

A person's writing is theirs: they can see it, take it with them, delete it, and know where it goes. Each new kind of data has to be wired into several hand-written lists, and **nothing fails loudly when one is missed** (circles were built on 2026-10-16 without a place in the export; see `docs/open-items.md` C4). This skill walks the lists.

## 1. Find the new data
From `git status` and `git diff --name-only`, list: new or changed `migrations/*.sql` (tables, columns, indexes), new API routes that write, new `lib/` files that run SQL, new keys stored in an existing table (for example ids kept in `card_customizations`), new files on disk (`ART_DIR`), new Redis keys, and new outbound calls (the AI, the worker API, the image tool).

## 2. Walk the list: PASS, GAP or N/A, each with a path and line
1. **Owner scoping.** A new table has `user_id` (or reaches one through a foreign key). Every query in the new routes filters by `session.userId`, including UPDATE and DELETE on `[id]` routes. Shared reference data says why it is shared. `npm test` includes `tests/route-auth.test.ts`.
2. **Deletion.** `ON DELETE CASCADE` from `users` (directly or through a parent). A `SET NULL` or kept record is deliberate and says why (answers keep a deleted swing's name). Anything outside the database is removed in `deleteUser` (`lib/auth.ts`): picture files (`artKeysOfUser`, `deleteArt`), Redis keys, worker tokens. Ownership that other people depend on is handed over first (`handOverBeforeDelete` for circles).
3. **Export.** Settings export is `app/api/export/route.ts` with `lib/export-tools.ts`, `lib/export-own.ts`, `lib/export-days.ts` and their Markdown forms. It is a hand-written list: the new data is in the JSON **and** in the readable Markdown, in the person's words and not as ids, and it never contains another person's data. Add a test next to `tests/export-own.test.ts` for the pure parts.
4. **Backup and restore.** `scripts/backup-db.ts` dumps every table, so a new table needs no change. Check only what lives outside the database (files: `--art-dir` covers `ART_DIR` and nothing else) and that a restore into an older schema is refused by `fieldsWithoutColumn` (`lib/backup-format.ts`) instead of losing the column quietly.
5. **Search.** If it is something the person wrote, does `lib/search.ts` need a group? Every query there is scoped by user id; shared things are found by name only, never by a stock meaning. If not now, log it in `docs/open-items.md` (Q1).
6. **Patterns and the companion.** Could the person's words reach the AI through `lib/companion-*.ts`, `lib/patterns*.ts` or `lib/reading-context.ts`? Then run `companion-privacy-audit`: only the person's own words, never stock text, nothing sent without the "Show what would be sent" screen. Note `tests/companion-pattern.test.ts` limits what `lib/patterns-symbols.ts` may import; write a small check inline rather than importing.
7. **Where it goes.** For every new outbound path, write down who receives what and why, and show it before it happens. Update `components/PrivacyNotice.tsx` and `docs/beta-tester-notice.md`. If what is collected or who sees it changes, **bump `PRIVACY_VERSION` in `lib/privacy.ts`** so people see the notice again, and keep `tests/privacy.test.ts` passing.
8. **Sharing.** Nothing reaches the forum or another person unless they post it (oracle rule 9). A circle shows names only. Check any shared view for hidden or private rows (the Ask route once read hidden forum posts).
9. **Limits.** A cap per person for things they can add (the pattern in `lib/own-limits.ts`), a length limit on every written field, and the AI quota (`lib/ai-quota.ts`) for anything that calls a model.
10. **The person's control.** They can edit, empty and delete every piece of it (oracle rule 7). Meanings keep earlier versions (rule 6), and those versions can be deleted too.
11. **Tests and notes.** A unit test for the pure parts. `docs/` updated where a guide describes the area.

## 3. Report
A table: row number, PASS / GAP / N/A, evidence. For each GAP, either fix it in this slice or add it to `docs/open-items.md` with the next free ID, so it is never silent. Say plainly what was not checked.

## Rules
- Reading and searching only. Do not run migrations and do not touch the live database.
- Related: `add-migration` (the SQL), `companion-privacy-audit` (the AI path), `new-api-route` (route conventions), `pre-commit-check` (run this first and it tells you when this one applies).
