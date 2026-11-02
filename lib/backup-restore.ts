// Reading a backup file made by scripts/backup-db.ts and putting its rows into a database. Shared by scripts/restore-db.ts (a Postgres server such as
// Neon) and scripts/neon-to-local.ts (a new local PGlite folder), so both restore the same way. Scripts only: it reads files and writes to a database.

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { BACKUP_FORMAT, fieldsWithoutColumn, tableOrder, type BackupHeader } from "./backup-format";

const BATCH = 500;

/** What a client needs for a restore: the `query` of a `pg` client, or of a local copy's client (lib/local-db.ts). */
export interface RestoreClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface BackupContents {
  header: BackupHeader;
  /** Each table's rows, as the JSON text the backup holds for them. */
  rows: Map<string, string[]>;
}

/** Reads the whole file first, so a bad or damaged file is found before anything is emptied. */
export async function readBackupFile(file: string): Promise<BackupContents> {
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
  return { header, rows };
}

export interface RestoreOptions {
  /** Without it, only checks and reports; nothing is changed. */
  yes: boolean;
  /** Restore even when the backup has fields the target has no column for (they are lost). */
  allowDroppedFields?: boolean;
  /** Tables of the backup that are left as the target has them (the local move keeps its own schema_migrations). */
  keepTables?: string[];
  /** What to tell the person to do when the target is missing tables or columns. */
  schemaHint: string;
  log?: (line: string) => void;
}

/**
 * Empties the backup's tables in the target and fills them from the backup, in one transaction, then checks every table's row count. Stops before
 * anything is emptied when the target lacks a table, or a column for a field the backup holds (unless allowDroppedFields). Returns false for a dry run.
 */
export async function restoreInto(client: RestoreClient, { header, rows }: BackupContents, opts: RestoreOptions): Promise<boolean> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const keep = new Set(opts.keepTables ?? []);
  const tables = header.tables.filter((t) => !keep.has(t.name));

  const { rows: existing } = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  const have = new Set(existing.map((r) => r.table_name));
  const missing = tables.map((t) => t.name).filter((t) => !have.has(t));
  if (missing.length) throw new Error(`The target database has no table(s): ${missing.join(", ")}. ${opts.schemaHint}`);

  // A field in the backup with no column in the target would be skipped without a word: stop before anything is emptied.
  const { rows: colRows } = await client.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
  );
  const columnsOf = new Map<string, string[]>();
  for (const c of colRows) columnsOf.set(c.table_name, [...(columnsOf.get(c.table_name) ?? []), c.column_name]);
  const lost: string[] = [];
  for (const t of tables) {
    const first = rows.get(t.name)?.[0];
    if (!first) continue;
    const extra = fieldsWithoutColumn(Object.keys(JSON.parse(first)), columnsOf.get(t.name) ?? []);
    if (extra.length) lost.push(`${t.name}.${extra.join(", ")}`);
  }
  if (lost.length) {
    const message = `The backup holds data the target has no column for: ${lost.join("; ")}.`;
    if (!opts.allowDroppedFields) {
      throw new Error(`${message} Restoring would lose it. ${opts.schemaHint} Or add --allow-dropped-fields to lose it on purpose. Nothing was changed.`);
    }
    log(`WARNING: ${message} It will not be restored (--allow-dropped-fields).`);
  }

  const { rows: fks } = await client.query<{ child: string; parent: string }>(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
     FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE c.contype = 'f' AND n.nspname = 'public'`
  );
  const strip = (s: string) => s.replace(/^public\./, "").replace(/"/g, "");
  const order = tableOrder(tables.map((t) => t.name), fks.map((f) => ({ child: strip(f.child), parent: strip(f.parent) })));
  log(`Order: ${order.join(", ")}`);
  if (!opts.yes) return false;

  await client.query("BEGIN");
  try {
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
      log(`  ${t}: ${list.length} rows restored`);
    }
    for (const t of tables) {
      const { rows: n } = await client.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "${t.name}"`);
      if (n[0].n !== t.rows) throw new Error(`Check failed for ${t.name}: ${n[0].n} rows, expected ${t.rows}`);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
  return true;
}
