/**
 * Moves a whole database from Neon (or any Postgres) into a new local data folder, so a copy can run on DS_DB_DIR instead of DATABASE_URL.
 *
 *   npx tsx scripts/neon-to-local.ts <backup file> --dir <new data folder> [--yes] [--allow-dropped-fields]
 *
 * It never connects to Neon. Make the backup file first with `npm run backup` (it only reads). Without --yes this checks the file against a
 * throwaway folder and reports; nothing is kept. With --yes it builds the new folder beside the target as `<folder>.part` (every migration in
 * this copy, then every row of the backup, then each table's row count is checked) and renames it to the target only when all of that worked.
 * It refuses a target that already exists, so it can never write over data. Neon is left exactly as it was, as a fallback.
 * docs/move-off-neon.md has the whole switch-over.
 */

import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { newerThanThisCopy } from "../lib/backup-format";
import { readBackupFile, restoreInto } from "../lib/backup-restore";
import { makeLocalPool } from "../lib/local-db";
import { migrationFiles } from "../lib/migrations";
import { secretsFileFor } from "../lib/local-secrets-core";
import { lockFileFor } from "../lib/local-lock-core";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : undefined;
}

async function fill(dir: string, file: string, yes: boolean): Promise<boolean> {
  const backup = await readBackupFile(file);
  const { header } = backup;
  console.log(`Backup from ${header.created} (host ${header.host}): ${header.tables.length} tables, ${header.tables.reduce((a, t) => a + t.rows, 0)} rows.`);
  const migrationsDir = join(process.cwd(), "migrations");
  const newer = newerThanThisCopy(header.migrations, migrationFiles(migrationsDir));
  if (newer.length) throw new Error(`The backup's database has migrations this copy does not have (${newer.join(", ")}). Update this copy of the app first. Nothing was changed.`);
  const owed = migrationFiles(migrationsDir).filter((m) => !header.migrations.includes(m));
  if (owed.length) console.log(`The new folder also gets ${owed.length} migration(s) the backup's database did not have yet: ${owed.join(", ")}`);

  // Opening the folder makes the database the way the app does: every migration, then the shared reference data (which the backup's rows replace).
  const pool = makeLocalPool(dir, migrationsDir, false);
  const client = await pool.connect();
  try {
    // The folder keeps its own record of migrations: it has had every one in this copy, and the backup's list may be shorter.
    return await restoreInto(client as never, backup, {
      yes,
      allowDroppedFields: process.argv.includes("--allow-dropped-fields"),
      keepTables: ["schema_migrations"],
      schemaHint: "This copy of the app is older than the database the backup came from: update it first.",
    });
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const file = process.argv[2];
  const target = arg("dir");
  if (!file || file.startsWith("--") || !target) throw new Error("Usage: neon-to-local.ts <backup file> --dir <new data folder> [--yes]");
  if (!existsSync(file)) throw new Error(`No such file: ${file}`);
  const dir = resolve(target);
  const yes = process.argv.includes("--yes");
  for (const p of [dir, secretsFileFor(dir), lockFileFor(dir)]) {
    if (existsSync(p)) throw new Error(`${p} already exists. Give a folder that does not exist yet; this never writes over data. Nothing was changed.`);
  }

  if (!yes) {
    const scratch = mkdtempSync(join(tmpdir(), "ds-move-check-"));
    try {
      await fill(join(scratch, "database"), file, false);
      console.log(`Check passed. Nothing was kept. Add --yes to make ${dir}.`);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    return;
  }

  const part = `${dir}.part`;
  if (existsSync(part)) throw new Error(`${part} is left from an earlier try that did not finish. Delete it, then run this again. Nothing was changed.`);
  mkdirSync(dirname(dir), { recursive: true });
  try {
    await fill(part, file, true);
  } catch (err) {
    rmSync(part, { recursive: true, force: true });
    throw err;
  }
  renameSync(part, dir);
  console.log(`Done: ${dir} holds every row of the backup, checked table by table.`);
  console.log(`Next: stop the app, set DS_DB_DIR=${dir} in .env.local and comment out DATABASE_URL there, then start it again (docs/move-off-neon.md).`);
}

main().catch((err) => {
  console.error("Move FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
