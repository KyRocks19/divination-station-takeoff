import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Runs the migrations folder against a database that is not Neon: the full local edition's PGlite folder (lib/local-db.ts). scripts/migrate.ts does
// the same for a Postgres server and stays as it is. Every migration is idempotent and additive (`add-migration`), and each runs inside its own
// transaction here, so a migration that fails leaves the database as it was before it began. Server code only.

export interface MigrationDb {
  /** Runs one or several statements with no parameters (a migration file has several). */
  exec(sql: string): Promise<unknown>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Whether data that has had this migration can still be used by a version of the app that does not have it. A migration says so with a line
 * `-- older-versions: ok` (it only adds: a new table, or a column that has a default, which older code never reads). Without that line the answer is
 * no, so a change nobody thought about stops an older version instead of letting it misread the data. Saved in schema_migrations.older_ok when the
 * migration runs, because an older version does not have the file to read (UPGRADING.md, "Going back to an older version").
 */
export const olderVersionsOk = (sql: string): boolean => /^--\s*older-versions:\s*ok\s*$/im.test(sql);

/** The marker every migration after this one must carry, `ok` or `no`, so the choice is made each time (tests/local-db.test.ts). */
export const LAST_UNMARKED_MIGRATION = "099_forum_bundle.sql";

/** The migration files in order: `NNN_name.sql`, sorted by name. */
export function migrationFiles(dir: string): string[] {
  // The ignore comments keep Next's file tracing from pulling the whole project into a hosted build because of a path chosen at run time:
  // only the full local edition ever reads this folder.
  return readdirSync(/* turbopackIgnore: true */ dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
}

/**
 * How many migrations this database has had, which files it has not had yet, and which it has had that this folder does not have (a newer version of
 * the app brought the data up to date): `unknown` lists those, and `blocking` the ones among them that did not say older versions can still use the
 * data. Reads only; a brand-new database has had none.
 */
export async function migrationState(db: MigrationDb, dir: string): Promise<{ applied: number; pending: string[]; unknown: string[]; blocking: string[] }> {
  const exists = (await db.query<{ t: string | null }>("SELECT to_regclass('schema_migrations')::text AS t")).rows[0]?.t;
  if (!exists) return { applied: 0, pending: migrationFiles(dir), unknown: [], blocking: [] };
  // Data from before older_ok existed has no such column; every row of it then counts as "no".
  const marked = (await db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'older_ok'")).rows[0]?.n;
  const rows = (await db.query<{ name: string; older_ok: boolean }>(marked ? "SELECT name, older_ok FROM schema_migrations" : "SELECT name, false AS older_ok FROM schema_migrations")).rows;
  const files = migrationFiles(dir);
  const have = new Set(files);
  const done = new Set(rows.map((r) => r.name));
  const unknown = rows.filter((r) => !have.has(r.name)).sort((a, b) => (a.name < b.name ? -1 : 1));
  return {
    applied: done.size,
    pending: files.filter((f) => !done.has(f)),
    unknown: unknown.map((r) => r.name),
    blocking: unknown.filter((r) => !r.older_ok).map((r) => r.name),
  };
}

/**
 * Data that a newer version of the app has brought up to date with a change that older versions cannot use (it did not say `-- older-versions: ok`):
 * this version does not open it, because it could misread it or write to it in a way the newer version does not expect. `blocking` names those changes.
 * Nothing has been changed when this is thrown. UPGRADING.md explains going back.
 */
export class NewerDataError extends Error {
  constructor(readonly blocking: string[]) {
    super(
      `This data was last used by a newer version of Divination Station, with ${blocking.length} change${blocking.length === 1 ? "" : "s"} this version cannot use (${blocking.slice(0, 3).join(", ")}${blocking.length > 3 ? ", ..." : ""}). ` +
        `Nothing was changed. Start the newer version instead, or see "Going back to an older version" in UPGRADING.md.`,
    );
    this.name = "NewerDataError";
  }
}

/** Applies every migration that `schema_migrations` does not list, in order, and returns the names it applied. */
export async function applyMigrations(db: MigrationDb, dir = join(/* turbopackIgnore: true */ process.cwd(), "migrations"), log: (line: string) => void = () => {}): Promise<string[]> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  // Whether older versions may still open the data after each migration (olderVersionsOk). Rows from before this column count as "no".
  await db.exec("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS older_ok BOOLEAN NOT NULL DEFAULT false");
  const done = new Set((await db.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const name of migrationFiles(dir)) {
    if (done.has(name)) continue;
    const sql = readFileSync(/* turbopackIgnore: true */ join(dir, name), "utf8");
    await db.exec("BEGIN");
    try {
      await db.exec(sql);
      await db.query("INSERT INTO schema_migrations (name, older_ok) VALUES ($1, $2)", [name, olderVersionsOk(sql)]);
      await db.exec("COMMIT");
    } catch (err) {
      await db.exec("ROLLBACK").catch(() => {});
      throw new Error(`Migration ${name} failed: ${err instanceof Error ? err.message : err}`);
    }
    applied.push(name);
    log(`Applied ${name}`);
  }
  return applied;
}
