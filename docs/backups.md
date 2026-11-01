# Backups

Written 2026-10-13. The people in the beta write journals and meanings; losing them would be the worst thing that can
happen to the app. Neon keeps a short history of its own, but that is a safety net, not a backup you control. These scripts
make a file you hold, check it, and keep it for weeks.

## What a backup is
One compressed file, `divination-station-YYYY-MM-DD-HHMM.jsonl.gz`, with every table of the database (a JSON line per
row). It is made inside one read-only transaction, so all tables are from the same moment, and the file is read back and
its row counts compared with the database before it is kept. The backup never changes the database.

Pictures that live in `ART_DIR` are copied into `art/` beside the backups (new or changed files only; nothing is ever
deleted there). **The pictures folder has no other copy**, so use `--art-dir` (below).

Old backups: the newest 14 are kept, plus the newest of each of the last 8 weeks.

## Make one now
```bash
npm run backup -- --art-dir C:/Users/you/DivinationStationArt
```
It reads `DATABASE_URL` from the environment, otherwise from `.env.local` (the live database), prints the host first, and
writes to `%USERPROFILE%\DivinationStationBackups` (change with `--out DIR` or `BACKUP_DIR`).

To back up the dev branch instead, put its address in the environment first (see `docs/dev-database.md`).

## Every day, automatically
Run once, yourself, in PowerShell from the project folder:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1 -ArtDir C:\Users\you\DivinationStationArt
```
It makes a Windows scheduled task (03:30 daily; runs when the computer is next on if it was off). Test it with
`Start-ScheduledTask -TaskName "Divination Station backup"`. Remove it with
`Unregister-ScheduledTask -TaskName "Divination Station backup" -Confirm:$false`.

Copy the backup folder somewhere else now and then (another drive, or a cloud folder you trust). A backup on the same disk
as the pictures survives a deleted database but not a dead disk.

## Restore
Restoring **empties** the target database's tables and fills them from the file, so try it first on a fresh Neon branch.
1. Make a new Neon branch (Console > Branches > Create branch) and copy its connection string.
2. Make the tables: `DATABASE_URL=<branch address> npm run migrate`
3. Look first: `DATABASE_URL=<branch address> npm run restore -- <file> --confirm-host <host of that address>`
   (without `--yes` it only reads the file and says what it would do).
4. Do it: add `--yes`.
The script refuses to run unless `--confirm-host` is exactly the host of `DATABASE_URL`, and it never reads `.env` files, so
an address left in your shell cannot be hit by mistake. After it finishes it counts every table against the file.
To make the restored branch the live one, point `DATABASE_URL` in `.env.local` (and on any hosted server) at it.

Before it empties anything, the restore also checks that every field in the file has a column in the target. If not (for
example the target was made with fewer migrations than the source), it stops and lists them, because the database would
otherwise skip those fields without a word. Fix it by running `npm run migrate` against the target; `--allow-dropped-fields`
loses them on purpose.

**Pictures.** The database restore does not touch `ART_DIR`. Copy the backup's `art` folder back into it
(`robocopy "%USERPROFILE%\DivinationStationBackups\art" C:\Users\you\DivinationStationArt /E`, which never deletes).
Pictures that are still stored in the database (no `ART_DIR` when they were made) are inside the backup file already.

## A rehearsal you can repeat (throwaway database, no Neon needed)
```bash
docker run -d --name ds-restore-test -e POSTGRES_PASSWORD=throwaway -e POSTGRES_DB=restoretest -p 55432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:throwaway@localhost:55432/restoretest
npm run migrate
npm run restore -- <backup file> --confirm-host localhost          # look first
npm run restore -- <backup file> --confirm-host localhost --yes    # do it
npm run backup -- --out <some empty folder>                        # back up the restored copy and compare its rows with the original
docker rm -f ds-restore-test
```

## Checked
- 2026-10-13: a throwaway local Postgres 16 (Docker): backup, restore into a second empty database, and a second backup
  of the restored copy; all 49 rows in 45 tables were identical, bytea and unicode text included, and serial numbers
  carried on after the restore.
- 2026-10-14: the same rehearsal with the **live** Neon database as the source (9,681 rows, 51 tables, 0.64 MB, 11 seconds
  to back up). Two gaps were found and closed: `release_cards` (a table) and `users.ai_provider` and `users.seeker_config`
  (columns) existed on live but in no migration, so a fresh database could not take a backup of live, and the second
  would have been lost without a word. Migrations 049 and 050 describe them; the restore now stops before it would lose
  a field. After that, every row of all 51 tables in the restored copy matched the original.
- 2026-10-14, later: the same cycle **into a Neon branch** (a copy of live, made in the console). The backup file was the one
  made by the scheduled task on the E: drive; `npm run restore` through Neon's pooled address emptied the branch and refilled it
  (9,684 rows, 51 tables, about a minute), and a backup of the branch matched the file in every row (0 differences). So the whole
  flow works against Neon itself, from a file on another drive.

## Stray picture files (open item P5 in `docs/open-items.md`)

A picture file is a stray when no database row names it (a row was deleted by hand, a save was interrupted, a test left it). The dev branch and the live database **share one art folder**, so a file the dev branch has no row for may be live's. `scripts/find-stray-art.ts` therefore asks for **both** addresses and calls a file a stray only when neither database has a row for it.

```
DATABASE_URL=<dev address> DATABASE_URL_2=<live address> ART_DIR=<folder> npx tsx scripts/find-stray-art.ts          # a report; changes nothing
DATABASE_URL=... DATABASE_URL_2=... ART_DIR=... npx tsx scripts/find-stray-art.ts --yes                              # moves strays into ART_DIR/_orphans
```

- It only reads the databases (SELECT), never reads `.env` files, and prints each host's first name only.
- It also lists rows whose file is missing (a restore of the database without the art folder looks like this), previews whose picture is gone, half-written `.part` files, and files named any other way (those are never touched).
- `--yes` moves, never deletes: a stray goes to `_orphans/<same path>` with its preview, and only if it is at least a day old. With one address `--yes` is refused. To put a file back, move it out of `_orphans`.
- Checked 2026-10-18 on the dev branch with a throwaway folder (report with one address, `--yes` refused with one, a day-old stray moved with its preview and a fresh one left with two). It has **not** been run on your real art folder or against live.
