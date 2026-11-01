---
name: live-migration-check
description: List the migrations dev and live lack, the code that needs them, and the order of steps for the user to run. Read-only. Use before a push or deploy.
---

# Live migration check

The user owes the live database many migrations, and code that needs a new column fails on a database that lacks it. This skill finds the gap, says which code is exposed, and writes the order of steps. **The user runs everything that changes the live database.**

## Steps
1. **Files.** `ls migrations | sort`. Note the highest number and the next free one. (`002` is absent on purpose; check other gaps against `git log` before calling them missing.)
2. **Dev branch.** Print the host first; it must start `ep-your-dev-branch`:
   ```bash
   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
   echo "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#'
   ```
   Then read the names in a short `check-migrations.mjs` written in the project root (so `pg` resolves) and **deleted afterwards**: connect with `ssl: { rejectUnauthorized: true }`, `BEGIN READ ONLY`, `SELECT name FROM schema_migrations ORDER BY name`, print only the names.
3. **Live.** Ask the user first: this reads the live database, only `schema_migrations` names and nothing else. If they agree, the same script with `.env.local`; the host must start `ep-your-live-db`. If they decline or it cannot be reached, take the owed list from `docs/open-items.md` section D and label every line **unverified**. Applied on dev is never evidence for live.
4. **Owed** = files not in each database's list. Report both lists.
5. **Read each owed migration** and give it one line: creates table X, adds column Y, changes a constraint or index. Flag anything that drops, renames or changes a column's type (the project rule is never to), and anything not idempotent (`add-migration` rule 1).
6. **What depends on it.** For each table or column an owed migration creates, `Grep` `app/`, `lib/`, `components/` and `scripts/`. Classify every use:
   - **guarded**: it catches a missing column or table (`42703`, `42P01`), as `lib/prefs.ts` does in its tiers and `lib/login-limit.ts` does;
   - **unguarded**: it will throw on a database without the migration. That code is a **deploy blocker** until the migration has run.
7. **Write the plan**, in order:
   1. the owed migrations, oldest first, with the one-line summary of each (show the SQL when the user asks, and always before they run it);
   2. the seed scripts that belong to them (for example `scripts/seed-symbol-archetypes.ts --allow-live`, after 059, with `DATABASE_URL` exported; the scripts never read `.env`);
   3. the command for the user, in its own block, after they have checked the host it will use:
      ```bash
      npm run migrate
      ```
      The output must show `✓ Applied` for the owed files only and `- Skipped` for the rest;
   4. only then the push and deploy (the user's call);
   5. afterwards, `open-item-sync` to correct the "owed" lines in the docs.
8. **Say what the check could not know:** a migration someone ran by hand, or a database branch that was reset.

## Rules
- Never run `npm run migrate`, a seed or any write against the live database. Never put a connection string or password in chat, a note or a commit; print the host only.
- A migration that has been applied is never edited; a change is a new file.
- Related: `add-migration` (writing the SQL, dev branch first), `neon-postgres` (connection details), `open-item-sync` (keeps the owed list true).
