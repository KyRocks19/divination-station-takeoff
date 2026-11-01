/**
 * Backs up the whole database to one compressed file, and (with --art-dir) the picture folder next to it.
 *
 *   npx tsx scripts/backup-db.ts [--out DIR] [--art-dir DIR] [--env FILE] [--keep-recent 14] [--keep-weeks 8]
 *
 * It only reads: the copy is made inside one read-only transaction, so every table is from the same moment. The address
 * comes from DATABASE_URL in the environment, or else from the DATABASE_URL line of --env (default .env.local). The
 * host is printed first. The file is read back and its row counts are compared with the database before old backups are removed.
 *
 * File format: gzip of JSON lines. Line 1 is a header (format, time, host, migrations, tables with row counts); each other
 * line is {"t": table, "r": the row as the database's own row_to_json}. scripts/restore-db.ts puts it back.
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { createReadStream, createWriteStream, existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, renameSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip, createGzip } from "node:zlib";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BACKUP_FORMAT, backupFileName, filesToRemove, hostOf, sslFor, type BackupHeader } from "../lib/backup-format";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = resolve(arg("env", ".env.local")!);
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL=(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("No DATABASE_URL: set it in the environment or in the file given with --env.");
}

async function writeLine(out: NodeJS.WritableStream, text: string): Promise<void> {
  if (!out.write(text + "\n")) await new Promise<void>((r) => out.once("drain", () => r()));
}

/** Copies pictures that are new or changed into DEST, never deleting anything there. Returns how many it copied. */
function mirrorFolder(from: string, to: string): number {
  let copied = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) {
      copied += mirrorFolder(src, dst);
    } else if (entry.isFile()) {
      const s = statSync(src);
      if (existsSync(dst) && statSync(dst).size === s.size && statSync(dst).mtimeMs >= s.mtimeMs) continue;
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      copied++;
    }
  }
  return copied;
}

async function main() {
  const url = databaseUrl();
  console.log(`Backing up the database on host: ${hostOf(url)}`);
  const outDir = resolve(arg("out", process.env.BACKUP_DIR || join(homedir(), "DivinationStationBackups"))!);
  mkdirSync(outDir, { recursive: true });

  const pool = new Pool({ connectionString: connectionStringFor(url), ssl: sslFor(url), max: 1 });
  const client = await pool.connect();
  const started = Date.now();
  const finalPath = join(outDir, backupFileName(new Date()));
  const tempPath = finalPath + ".part";
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    );
    const tables = tableRows.map((r) => r.table_name);
    const counts: { name: string; rows: number }[] = [];
    for (const t of tables) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
      counts.push({ name: t, rows: rows[0].n });
    }
    const migrations = tables.includes("schema_migrations")
      ? (await client.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name")).rows.map((r) => r.name)
      : [];

    const header: BackupHeader = { format: BACKUP_FORMAT, created: new Date().toISOString(), host: hostOf(url), migrations, tables: counts };
    const gzip = createGzip({ level: 9 });
    const file = createWriteStream(tempPath);
    gzip.pipe(file);
    const finished = new Promise<void>((res, rej) => { file.on("finish", () => res()); file.on("error", rej); gzip.on("error", rej); });
    await writeLine(gzip, JSON.stringify(header));
    for (const { name, rows } of counts) {
      // One table at a time, in id-less order: a restore does not depend on the order within a table.
      const { rows: data } = await client.query<{ j: string }>(`SELECT row_to_json(t)::text AS j FROM "${name}" t`);
      if (data.length !== rows) throw new Error(`${name}: counted ${rows} rows but read ${data.length}`);
      for (const r of data) await writeLine(gzip, `{"t":${JSON.stringify(name)},"r":${r.j}}`);
      console.log(`  ${name}: ${rows} rows`);
    }
    gzip.end();
    await finished;
    await client.query("COMMIT");

    // Read the file back and compare with the counts taken inside the snapshot.
    const seen = new Map<string, number>();
    const rl = createInterface({ input: createReadStream(tempPath).pipe(createGunzip()), crlfDelay: Infinity });
    let first = true;
    for await (const line of rl) {
      if (first) {
        first = false;
        const h = JSON.parse(line) as BackupHeader;
        if (h.format !== BACKUP_FORMAT) throw new Error("The file's header is wrong");
        continue;
      }
      const t = (JSON.parse(line) as { t: string }).t;
      seen.set(t, (seen.get(t) ?? 0) + 1);
    }
    for (const { name, rows } of counts) {
      if ((seen.get(name) ?? 0) !== rows) throw new Error(`Check failed for ${name}: ${rows} in the database, ${seen.get(name) ?? 0} in the file`);
    }
    renameSync(tempPath, finalPath);
    const mb = (statSync(finalPath).size / 1_000_000).toFixed(2);
    const total = counts.reduce((a, c) => a + c.rows, 0);
    console.log(`Wrote ${finalPath} (${mb} MB, ${total} rows in ${counts.length} tables, checked) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (existsSync(tempPath)) unlinkSync(tempPath);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  // Remove old backups only after this one is written and checked.
  const keepRecent = Number(arg("keep-recent", "14"));
  const keepWeeks = Number(arg("keep-weeks", "8"));
  const old = filesToRemove(readdirSync(outDir), keepRecent, keepWeeks);
  for (const name of old) unlinkSync(join(outDir, name));
  if (old.length) console.log(`Removed ${old.length} old backup(s): keeping the newest ${keepRecent} and one per week for ${keepWeeks} weeks.`);

  const artDir = arg("art-dir", process.env.ART_DIR);
  if (artDir && existsSync(artDir)) {
    const copied = mirrorFolder(resolve(artDir), join(outDir, "art"));
    console.log(`Pictures: copied ${copied} new or changed file(s) from ${resolve(artDir)} to ${join(outDir, "art")}`);
  } else if (artDir) {
    console.log(`Pictures: the folder ${artDir} does not exist; skipped.`);
  }
}

main().catch((err) => {
  console.error("Backup FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
