/**
 * Puts a backup made by scripts/backup-db.ts back into a database.
 *
 *   DATABASE_URL=... npx tsx scripts/restore-db.ts <backup file> --confirm-host <host of that database> [--yes] [--allow-dropped-fields]
 *
 * Without --yes it only reads the file and reports what it would do. With --yes it EMPTIES every table of the target
 * database and fills them from the file. It never reads .env files, and it refuses to run unless --confirm-host names the
 * host of DATABASE_URL, so a live address left in the shell cannot be hit by mistake. Make the schema first with
 * `npm run migrate` against the target (a fresh Neon branch is the safest place to try a restore).
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { hostOf, sslFor } from "../lib/backup-format";
import { readBackupFile, restoreInto } from "../lib/backup-restore";

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) throw new Error("Usage: restore-db.ts <backup file> --confirm-host <host> [--yes]");
  const yes = process.argv.includes("--yes");
  const ci = process.argv.indexOf("--confirm-host");
  const confirmHost = ci >= 0 ? process.argv[ci + 1] : undefined;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in the environment to the database to restore into.");
  const host = hostOf(url);
  console.log(`Target database host: ${host}`);
  if (confirmHost !== host) throw new Error(`--confirm-host must be exactly "${host}" (the host of DATABASE_URL). Nothing was changed.`);

  // Read the whole file first, so a bad file is found before anything is emptied.
  const backup = await readBackupFile(file);
  const { header } = backup;
  console.log(`Backup from ${header.created} (host ${header.host}): ${header.tables.length} tables, ${header.tables.reduce((a, t) => a + t.rows, 0)} rows.`);

  const pool = new Pool({ connectionString: connectionStringFor(url), ssl: sslFor(url), max: 1 });
  const client = await pool.connect();
  try {
    const done = await restoreInto(client, backup, {
      yes,
      allowDroppedFields: process.argv.includes("--allow-dropped-fields"),
      schemaHint: "Run npm run migrate against the target first.",
    });
    console.log(done ? "Restore finished and checked." : "Dry run: nothing was changed. Add --yes to empty the target's tables and restore.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Restore FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
