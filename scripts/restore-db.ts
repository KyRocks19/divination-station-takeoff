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
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { BACKUP_FORMAT, fieldsWithoutColumn, hostOf, sslFor, tableOrder, type BackupHeader } from "../lib/backup-format";

const BATCH = 500;

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
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  let header: BackupHeader | null = null;
  const rows = new Map<string, string[]>();
  for await (const line of rl) {
    if (!header) {
      header = JSON.parse(line) as BackupHeader;
      if (header.format !== BACKUP_FORMAT) throw new Error(`Not a backup file of this app (format "${header.format}").`);
      continue;
    }
    const m = /^\{"t":("(?:[^"\\]|\\.)*"),"r":([\s\S]*)\}$/.exec(line);
    if (!m) throw new Error("A line of the file is not in the expected form.");
    const t = JSON.parse(m[1]) as string;
    if (!rows.has(t)) rows.set(t, []);
    rows.get(t)!.push(m[2]);
  }
  if (!header) throw new Error("The file is empty.");
  for (const t of header.tables) {
    if ((rows.get(t.name)?.length ?? 0) !== t.rows) throw new Error(`The file is damaged: ${t.name} should have ${t.rows} rows.`);
  }
  console.log(`Backup from ${header.created} (host ${header.host}): ${header.tables.length} tables, ${header.tables.reduce((a, t) => a + t.rows, 0)} rows.`);

  const pool = new Pool({ connectionString: connectionStringFor(url), ssl: sslFor(url), max: 1 });
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const have = new Set(existing.map((r) => r.table_name));
    const missing = header.tables.map((t) => t.name).filter((t) => !have.has(t));
    if (missing.length) throw new Error(`The target database has no table(s): ${missing.join(", ")}. Run npm run migrate against it first.`);

    // A field in the backup with no column in the target would be skipped without a word: stop before anything is emptied.
    const { rows: colRows } = await client.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
    );
    const columnsOf = new Map<string, string[]>();
    for (const c of colRows) columnsOf.set(c.table_name, [...(columnsOf.get(c.table_name) ?? []), c.column_name]);
    const lost: string[] = [];
    for (const t of header.tables) {
      const first = rows.get(t.name)?.[0];
      if (!first) continue;
      const extra = fieldsWithoutColumn(Object.keys(JSON.parse(first)), columnsOf.get(t.name) ?? []);
      if (extra.length) lost.push(`${t.name}.${extra.join(", ")}`);
    }
    if (lost.length) {
      const message = `The backup holds data the target has no column for: ${lost.join("; ")}.`;
      if (!process.argv.includes("--allow-dropped-fields")) {
        throw new Error(`${message} Restoring would lose it. Run npm run migrate against the target first, or add --allow-dropped-fields to lose it on purpose. Nothing was changed.`);
      }
      console.log(`WARNING: ${message} It will not be restored (--allow-dropped-fields).`);
    }

    const { rows: fks } = await client.query<{ child: string; parent: string }>(
      `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE c.contype = 'f' AND n.nspname = 'public'`
    );
    const strip = (s: string) => s.replace(/^public\./, "").replace(/"/g, "");
    const order = tableOrder(header.tables.map((t) => t.name), fks.map((f) => ({ child: strip(f.child), parent: strip(f.parent) })));
    console.log(`Order: ${order.join(", ")}`);
    if (!yes) {
      console.log("Dry run: nothing was changed. Add --yes to empty the target's tables and restore.");
      return;
    }

    await client.query("BEGIN");
    await client.query(`TRUNCATE ${[...order].reverse().map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    for (const t of order) {
      const list = rows.get(t) ?? [];
      for (let i = 0; i < list.length; i += BATCH) {
        const chunk = `[${list.slice(i, i + BATCH).join(",")}]`;
        await client.query(`INSERT INTO "${t}" SELECT * FROM json_populate_recordset(NULL::"${t}", $1::json)`, [chunk]);
      }
      // Serial columns carry on after the highest restored number.
      const { rows: serials } = await client.query<{ column_name: string }>(
        `SELECT a.attname AS column_name FROM pg_attribute a
         WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped AND pg_get_serial_sequence($2, a.attname) IS NOT NULL`,
        [`"${t}"`, `"${t}"`]
      );
      for (const { column_name } of serials) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, $2), GREATEST(COALESCE((SELECT MAX("${column_name}") FROM "${t}"), 0), 1), (SELECT COUNT(*) FROM "${t}") > 0)`,
          [`"${t}"`, column_name]
        );
      }
      console.log(`  ${t}: ${list.length} rows restored`);
    }
    for (const t of header.tables) {
      const { rows: n } = await client.query(`SELECT COUNT(*)::int AS n FROM "${t.name}"`);
      if (n[0].n !== t.rows) throw new Error(`Check failed for ${t.name}: ${n[0].n} rows, expected ${t.rows}`);
    }
    await client.query("COMMIT");
    console.log("Restore finished and checked.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Restore FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
