# Moving the family circle's copy off Neon

Written 2026-11-02. The family circle's copy has run on the owner's computer since 2026-10-30, but its database was still on Neon. This moves the whole database (every member's data) into a local data folder, the same kind of folder the local edition uses (`DS_DB_DIR`, PGlite). Neon is not changed, so it stays as a fallback until you delete it.

## What changes and what does not
- **Same:** the app, the edition (hosted, one family circle, `DS_FAMILY_CIRCLE_ID`), sign-ins, members, pictures in `ART_DIR`, Tailscale. Every secret in `.env.local` stays as it is.
- **The data lives in one folder** on this computer. The app brings it up to date by itself on each start, and saves a copy first when an update brings new migrations. `npm run migrate` is no longer needed for this copy.
- **Backups:** the app makes a weekly backup by itself, and Settings, Backups has "Back up now". They are saved in `<data folder>.backups`, beside the folder. Copy them to another drive now and then; the old scheduled `npm run backup` task only reads Neon, so turn it off after the move.
- **Stopping:** `scripts/start-app.ps1` and `update-and-restart.cmd` now let the app close the database itself on Ctrl+C when `.env.local` has `DS_DB_DIR`. Closing the window, or the update script's forced stop, is like pulling the plug: the database recovers on the next start, but stop it with Ctrl+C when you can.
- **One database session.** Pages for several people take turns. For a family circle that is fine.
- **The copy is reachable only while this computer is on.** That is already true today.

## Before you start
1. Pick the new data folder. It must not exist yet, for example `C:\Users\you\DivinationStationData\database`. Keep it out of OneDrive or another syncing folder: syncing a database folder while the app has it open can damage it.
2. Check `.env.local` has `SESSION_SECRET` and `CIRCLE_KEY_SECRET`. Keep both exactly as they are. `CIRCLE_KEY_SECRET` unlocks the circle's saved Claude key; a new one would leave that key unreadable, and a new `SESSION_SECRET` signs everyone out.
3. Update this copy to the newest version (`update-and-restart.cmd`). The move refuses a backup from a database that has migrations this copy does not have.

## The move (about 15 minutes, most of it waiting)
1. Tell the circle the app will be off for a few minutes, then stop the app.
2. Make a fresh backup of live. It only reads: `npm run backup`. It prints the file it wrote (`divination-station-YYYY-MM-DD-HHMM.jsonl.gz`).
3. Check the move without keeping anything:

       npx tsx scripts/neon-to-local.ts <that backup file> --dir C:\Users\you\DivinationStationData\database

   It builds the database in a throwaway folder, checks every table, and deletes it. It ends with "Check passed".
4. Do it:

       npx tsx scripts/neon-to-local.ts <that backup file> --dir C:\Users\you\DivinationStationData\database --yes

   It builds `database.part`, runs every migration (including any that live was still owed), fills every row, checks each table's row count, and only then renames it to `database`. If anything fails, it removes `database.part` and nothing is left behind.
5. In `.env.local`, add `DS_DB_DIR=C:\Users\you\DivinationStationData\database` and put `#` in front of the `DATABASE_URL` line. Leave everything else alone.
   **Also add a line `DS_DB_DIR=` (with nothing after it) to `.env.development.local`.** `npm run dev` reads `.env.local` too, so without that line it would open the family's data folder instead of the Neon dev branch. The empty line in the dev file wins and keeps dev on Neon.
6. Start the app. Its window should **not** say any migration was applied (the move already applied them all). Sign in, open a few readings and a member's page, and check the circle is there.
7. Turn off the scheduled `npm run backup` task (`scripts/schedule-backup.ps1` made it), and make one "Back up now" in Settings, Backups.

## Going back
Until you delete Neon, you can go back: stop the app, remove the `DS_DB_DIR` line, take the `#` off `DATABASE_URL`, and start it. Neon holds the data as it was at the moment of the move, so anything written after the move stays only in the local folder.

## Later
- **The dev branch.** With the empty `DS_DB_DIR=` line, `npm run dev` still reads the Neon dev branch. To drop Neon completely, give dev its own folder instead: change that line to `DS_DB_DIR=C:\Users\you\DivinationStationData\dev-database` (a new folder is set up on first start, or move a backup of dev into it with the script above). Never point dev at the family's folder; the app refuses to open a folder another copy has open, but not one that is closed.
- **`update-migrate-and-restart.cmd`** migrates the Neon databases. After the move use `update-and-restart.cmd`; the app migrates its own folder on start.
- Delete the Neon project only when you are sure you will not go back, and after keeping one last `npm run backup` file somewhere safe.
