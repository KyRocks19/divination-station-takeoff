# A separate database for development

Written 2026-10-12. Today the dev server, the scripts, and the tests of new code all use the **live** Neon database (one
`DATABASE_URL` in `.env.local`). A Neon *branch* is a copy-on-write clone of it: free to make, instant, and changes on it
never touch the live data. The steps that need your Neon login are yours; everything else is already wired.

## Make the branch (Neon console, about two minutes)
1. Open the project in the Neon console, then **Branches > Create branch**. Name it `dev`, parent `main` (or whatever your
   live branch is called), "current data".
2. Open the new branch's **Connect** panel and copy its connection string (the pooled one is fine).

## Point development at it (nothing in git)
Next.js reads `.env.development.local` **after** `.env.local` and it wins, but only for `npm run dev`. Create that file in the
project root with one line:

```
DATABASE_URL=postgresql://...the dev branch string...
```

`npm run build` and `npm start` keep using `.env.local`, so production is untouched.
`.env*.local` files are in `.gitignore`.

## Scripts and migrations
`scripts/*.ts` and `npm run migrate` read `.env.local` only. To run one against the dev branch, set the variable for that
one command:

```powershell
$env:DATABASE_URL = "postgresql://...dev branch..."; npm run migrate; Remove-Item Env:DATABASE_URL
```

(`scripts/migrate.ts` does not overwrite a `DATABASE_URL` that is already set.)

## The usual routine
1. Try the new migration on the `dev` branch first.
2. Click through the change on the dev server.
3. Run the same migration on the live branch (the old way), then deploy.
4. When the dev branch drifts, delete it and make a fresh one from `main`: that is the "reset".

Test accounts made in earlier sessions (`claude`, `claude-1012-*`) live in the live database; a branch made today contains
copies of them with the same data, but their passwords are only in the old sessions' scratchpads, so make a new test account
on the branch (see the working notes in `.claude/skills/oracle-feature-design/PROGRESS.md`).

## How fast the database answers, and the pool (open item P7, measured 2026-10-18)
`npx tsx scripts/measure-db.ts` (with `DATABASE_URL` exported from `.env.development.local`; read-only; it refuses anything but the dev branch unless you add `--allow-live`).
On 2026-10-18, from the owner's PC to the dev branch's pooled address: a **new connection plus `SELECT 1` took about 230 to 310 ms** (median 256), a **query on a connection already open about 36 ms**. Twenty queries of 50 ms each, started at once, took 937 ms with a pool of 2, 536 ms with 5, 396 ms with 10 and 338 ms with 20.
What that means: the cost of a page is mostly the number of new connections it has to open, so `idleTimeoutMillis` (30 s) matters more than the pool size; a smaller pool trades speed for fewer connections on Neon's side. **`DB_POOL_MAX`** (1 to 20, default 10, the same as before) lowers the number of connections one server process keeps; set it (for example to 5) on the production server only if Neon starts refusing connections when several servers run, and say what you saw. The refusals could not be made to happen on demand, so no default was changed.
**`queryRead` and `queryReadOne`** in `lib/db.ts` retry a plain SELECT up to twice when the connection (not the statement) fails; the caller chooses them, nothing is guessed from the SQL. The account check that runs on nearly every page uses `queryReadOne`. A statement that has been sent is never retried by `query`.
