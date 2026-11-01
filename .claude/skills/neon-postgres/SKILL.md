---
name: neon-postgres
description: Neon facts for this project's database (dev and live branches, pooling, cold starts, restore). Use for questions about Neon itself.
---

# Neon (this project's database)

Trimmed on 2026-10-17 from the vendor's general guide (which covered Neon Auth, the Data API, the Python SDK and more, none of which this app uses). The Neon documentation is the source of truth; Neon changes, so fetch the page instead of answering from memory.

## How the docs are fetched
- Add `.md` to any docs URL: `https://neon.com/docs/introduction/branching.md`.
- The index of every page: `https://neon.com/docs/llms.txt`. Search it; do not guess URLs.

## What this project uses
- **Two branches.** Live host starts `ep-your-live-db` (`.env.local`); the dev branch starts `ep-your-dev-branch` (`.env.development.local`, read only by `npm run dev`). Builds, `npm start` and scripts read the live one. Print the host only, never the connection string, and check it before any migration or script. Details and the routine: `docs/dev-database.md`, `add-migration`.
- **Driver.** `pg` through `lib/db.ts` (`query`, `queryOne`, `withTransaction`), on the pooled host (`-pooler` in the name, PgBouncer). The connection retries three times and keeps an unused connection for 30 seconds. Certificates are checked (`lib/db-ssl.ts`). Not the Neon serverless driver, not the Data API, not Neon Auth.
- **Cold starts and slow connections.** An idle compute suspends and the first query pays a delay; opening a connection has taken 0.4 to 4 seconds on bad days. A "timeout exceeded when trying to connect" is usually that, not a bug (`PROGRESS.md` working notes).
- **Branches are copy-on-write clones.** A dev branch drifts from live; when it does, delete it and make a fresh one from the live branch. Test accounts on the dev branch are kept on purpose.
- **Backups.** Neon's own point-in-time restore is a safety net with a short window, not the backup. Ours is `npm run backup` (`docs/backups.md`); restore tests go into a fresh branch.

## Pages worth fetching
- Branching: https://neon.com/docs/ai/skills/neon-postgres/references/branching.md
- Connection methods and drivers: https://neon.com/docs/ai/skills/neon-postgres/references/connection-methods.md
- Connection pooling: https://neon.com/docs/connect/connection-pooling.md
- Scale to zero: https://neon.com/docs/introduction/scale-to-zero.md
- Instant restore: https://neon.com/docs/introduction/branch-restore.md
- Neon CLI (`neonctl`): https://neon.com/docs/ai/skills/neon-postgres/references/neon-cli.md
- Admin REST API: https://neon.com/docs/ai/skills/neon-postgres/references/neon-rest-api.md

## Rules
- Never put a connection string, password or API key in chat, a note or a commit.
- Never run a write against the live branch from a session: migrations and seeds on live are the user's to run (`live-migration-check` prepares them).
