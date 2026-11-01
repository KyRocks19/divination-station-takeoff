---
name: add-migration
description: Add or change a Postgres schema migration. Use when a feature needs a new table, column or index, or when running `npm run migrate`.
---

# Adding a migration

Migrations live in `migrations/NNN_name.sql` (next number = highest + 1; `002` is intentionally absent).
`scripts/migrate.ts` auto-discovers every `NNN_*.sql`, sorts them, and records applied files in the
`schema_migrations` table. No manual registration is needed.

## Rules
1. **Must be idempotent**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
   `ON CONFLICT DO NOTHING`, or a `DO $$ ... IF NOT EXISTS ... $$` block (see `011_reversed_concepts.sql`).
   Databases that predate `schema_migrations` re-run old files once.
2. Postgres dialect only. Existing boolean-ish columns use integers (`is_admin`, `is_preset` = 0/1); match
   the neighboring table's convention.
3. Add a one-line comment at the top describing the change.
4. Never edit an already-applied migration; add a new one.
5. Update TypeScript types and queries that touch the changed tables.
6. **Say whether older versions can still use the data**, in a line of its own: `-- older-versions: ok` (only a new table, or a new column with a default that older code never reads) or `-- older-versions: no` (anything older code could misread). Unmarked counts as `no`, and `tests/local-db.test.ts` fails on an unmarked file after 099. An `ok` migration must not rely on a one-time data step for rows written later; put that in start-up code (`lib/local-seed.ts`). Why: an older downloaded copy opens newer data only when every newer change said `ok` (`docs/setup-guide.md`, "Updating a copy").

## Running (live Neon DB, confirm first)
`npm run migrate` loads `.env.local` and writes to the **live** database.
Before running: show the user the SQL and the list of pending files, and get an explicit OK.
After: confirm the output shows `✓ Applied` for the new file only (others `- Skipped`).

## After writing it
1. Run it on the dev branch (next section) and click through the change (`test-as-user`).
2. Run `data-lifecycle-check`: owner scoping, deletion, the Settings export, search, the companion, the privacy notice. Nothing fails loudly when one of these is missed.
3. Before any push or deploy, run `live-migration-check`: it lists what live is missing, which code breaks without it, and the order of steps for the user. Code that reads a new column needs the migration on live **first**, or a guard like the tiers in `lib/prefs.ts`.
4. Record the number as owed in `docs/open-items.md` (section B or D); `open-item-sync` keeps that line true.

## Dev branch first (added 2026-10-15)
Run every new migration on the Neon **dev branch** before live. `npm run migrate` reads `.env.local` (live), so point it at dev explicitly:
```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
echo "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#'   # print ONLY the host, then check it
```
Dev host starts `ep-your-dev-branch`; live starts `ep-your-live-db`. Make migrations idempotent, never rename or drop. The live database is migrated by the user, who is owed the earlier ones (see PROGRESS.md).
