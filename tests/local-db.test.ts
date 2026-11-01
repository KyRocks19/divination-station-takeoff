// Checks on the full local edition's database layer (open items ED8 and ED9, step 1). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Lease, errorText, isFileError, localDbDir, openFailureMessage, pgShaped } from "../lib/local-db-core";
import { LAST_UNMARKED_MIGRATION, applyMigrations, migrationFiles, olderVersionsOk, type MigrationDb } from "../lib/migrations";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("a lease is held until it is given back, and askers are served in the order they asked", async () => {
  const lease = new Lease();
  const order = [] as string[];
  const first = await lease.take();
  const second = lease.take().then((release) => { order.push("second"); release(); });
  const third = lease.take().then((release) => { order.push("third"); release(); });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(order.length, 0, "nobody else runs while the first holds it");
  order.push("first");
  first();
  first(); // giving it back twice does no harm
  await Promise.all([second, third]);
  assert.deepEqual(order, ["first", "second", "third"]);
});

test("twenty askers at once each run alone", async () => {
  const lease = new Lease();
  let inside = 0;
  let worst = 0;
  await Promise.all(Array.from({ length: 20 }, async () => {
    const release = await lease.take();
    inside++;
    worst = Math.max(worst, inside);
    await new Promise((r) => setTimeout(r, 1));
    inside--;
    release();
  }));
  assert.equal(worst, 1);
});

test("answers look like pg's: rows and rowCount", () => {
  assert.deepEqual(pgShaped({ rows: [{ a: 1 }], affectedRows: 3 }), { rows: [{ a: 1 }], rowCount: 3 });
  assert.deepEqual(pgShaped({ rows: [{ a: 1 }, { a: 2 }] }), { rows: [{ a: 1 }, { a: 2 }], rowCount: 2 });
});

test("the local database is used only when DS_DB_DIR is set", () => {
  assert.equal(localDbDir(undefined), null);
  assert.equal(localDbDir("  "), null);
  assert.equal(localDbDir(" C:/data/ds "), "C:/data/ds");
});

test("migrations: the real folder is listed in order, and only the ones not yet applied run, each in its own transaction", async () => {
  const names = migrationFiles(path.join(root, "migrations"));
  assert.ok(names.length >= 77 && names.every((n, i) => i === 0 || names[i - 1] < n), "the real folder is listed in order");
  const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
  writeFileSync(path.join(dir, "001_a.sql"), "SELECT 1;");
  writeFileSync(path.join(dir, "002_b.sql"), "SELECT 2;");
  writeFileSync(path.join(dir, "003_bad.sql"), "SELECT broken;");
  writeFileSync(path.join(dir, "notes.txt"), "not a migration");
  const ran: string[] = [];
  const recorded = new Set<string>(["001_a.sql"]);
  const db: MigrationDb = {
    async exec(sql) {
      ran.push(sql);
      if (sql === "SELECT broken;") throw new Error("column broken does not exist");
    },
    async query(sql: string, params?: unknown[]) {
      if (/INSERT INTO schema_migrations/.test(sql)) recorded.add(String(params?.[0]));
      return { rows: sql.startsWith("SELECT name") ? [...recorded].map((name) => ({ name })) : [] } as { rows: never[] };
    },
  };
  await assert.rejects(() => applyMigrations(db, dir), /Migration 003_bad\.sql failed: column broken does not exist/);
  assert.ok(!ran.includes("SELECT 1;"), "001 was already applied, so it did not run again");
  assert.ok(ran.includes("SELECT 2;") && recorded.has("002_b.sql"), "002 ran and was recorded");
  assert.ok(!recorded.has("003_bad.sql"), "a failed migration is not recorded");
  const at = (s: string) => ran.indexOf(s);
  assert.deepEqual(ran.slice(at("SELECT 2;") - 1, at("SELECT 2;") + 1), ["BEGIN", "SELECT 2;"], "each migration begins a transaction");
  assert.ok(ran.includes("ROLLBACK"), "the failed one is rolled back");
});

test("db.ts keeps the hosted path as it was, and the local one is behind DS_DB_DIR and loaded lazily", () => {
  const db = read("lib/db.ts");
  assert.ok(/const localDir = localDbDir\(\);\s+if \(localDir && !globalForDb\.__stationPool\)/.test(db));
  assert.ok(db.includes("new Pool({") && db.includes("connectionStringFor(process.env.DATABASE_URL)"), "the Neon pool is unchanged");
  const local = read("lib/local-db.ts");
  assert.ok(local.includes('await import("@electric-sql/pglite")'), "PGlite is loaded when first used, not at start-up");
  assert.ok(!/^import .*pglite/m.test(local), "no static import of PGlite");
  assert.match(read("next.config.ts"), /serverExternalPackages: \["pg", "@electric-sql\/pglite"\]/);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["@electric-sql/pglite"], "0.5.10", "pinned to one version");
});

test("a migration says whether older versions can still use the data; without the line the answer is no", () => {
  assert.equal(olderVersionsOk("-- Adds a table.\n-- older-versions: ok\nCREATE TABLE IF NOT EXISTS x (id INT);"), true);
  assert.equal(olderVersionsOk("--older-versions:OK\nSELECT 1;"), true);
  assert.equal(olderVersionsOk("-- older-versions: no\nALTER TABLE x ADD COLUMN y INT;"), false);
  assert.equal(olderVersionsOk("-- Adds a table.\nCREATE TABLE IF NOT EXISTS x (id INT);"), false, "unmarked means no");
  assert.equal(olderVersionsOk("SELECT '-- older-versions: ok later on the line';"), false, "only a line of its own counts");
});

test("every migration after the last unmarked one says ok or no for older versions (UPGRADING.md, docs/setup-guide.md)", () => {
  const names = migrationFiles(path.join(root, "migrations"));
  assert.ok(names.includes(LAST_UNMARKED_MIGRATION), "the last unmarked migration is still in the folder");
  for (const name of names.filter((n) => n > LAST_UNMARKED_MIGRATION)) {
    assert.match(read(`migrations/${name}`), /^--\s*older-versions:\s*(ok|no)\s*$/im, `${name} must have a line "-- older-versions: ok" or "-- older-versions: no"`);
  }
});

test("errorText never prints [object Object], and names PGlite file problems in plain words", () => {
  // The shape PGlite throws when its file layer fails (seen on a read-only data folder): only `name` and a WASI errno.
  const denied = { name: "ErrnoError", errno: 2 };
  assert.ok(isFileError(denied));
  assert.equal(errorText(denied), "permission denied (EACCES)");
  assert.equal(errorText({ name: "ErrnoError", errno: 999 }), "a file problem (file error number 999)");
  assert.equal(errorText(new Error("boom")), "boom");
  assert.equal(errorText(new Error("outer", { cause: denied })), "outer (permission denied (EACCES))");
  assert.equal(errorText({ message: "plain object" }), "plain object");
  assert.equal(errorText({ status: 1 }), "{\"status\":1}");
  assert.equal(errorText("text"), "text");
  for (const v of [{}, Object.create(null), denied, { name: "ErrnoError", errno: 44 }]) assert.ok(!errorText(v).includes("[object Object]"), String(v?.constructor?.name));
});

test("openFailureMessage says where, what and what to try", () => {
  const msg = openFailureMessage("F:\\my-data\\database", { name: "ErrnoError", errno: 69 });
  assert.match(msg, /F:\\my-data\\database/);
  assert.match(msg, /read-only \(EROFS\)/);
  assert.match(msg, /write-protected/);
  assert.equal(openFailureMessage("x", new Error("odd")), "The database in x could not be opened: odd.");
});

test("local-db.ts wraps the PGlite opening, and the db and backup logs use errorText", () => {
  assert.match(read("lib/local-db.ts"), /openFailureMessage\(/);
  for (const f of ["lib/db.ts", "lib/local-backup.ts", "lib/local-db.ts"]) assert.doesNotMatch(read(f), /err instanceof Error \? err\.message : (String\()?err/, f);
});
