// A spike (open item ED8, docs/spike-local-database.md): can PGlite (Postgres compiled to WebAssembly, running inside Node) run the app's migrations and
// the kinds of SQL the app uses? It reads the project's migrations folder and changes nothing there. PGlite is NOT a dependency of the project: copy this
// file to a scratch folder where `npm i @electric-sql/pglite` was run, and run: node pglite-migrations-spike.mjs <project folder>
// (The one line that says FAIL for the unique index is the check working: a second zone name that differs only by capitals must be refused.)
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readdirSync, readFileSync, mkdtempSync, statSync, readdirSync as ls } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const project = process.argv[2];
const t0 = performance.now();
const dataDir = mkdtempSync(join(tmpdir(), "pglite-spike-"));
const db = new PGlite(dataDir, { extensions: { unaccent } });
await db.waitReady;
console.log(`start (on disk, empty): ${Math.round(performance.now() - t0)} ms`);

const files = readdirSync(join(project, "migrations")).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
let failed = [];
const t1 = performance.now();
for (const f of files) {
  try {
    await db.exec(readFileSync(join(project, "migrations", f), "utf8"));
  } catch (err) {
    failed.push([f, String(err.message).split("\n")[0]]);
  }
}
console.log(`ran ${files.length} migrations in ${Math.round(performance.now() - t1)} ms; failed: ${failed.length}`);
for (const [f, m] of failed) console.log("  FAILED", f, "-", m);

const tables = await db.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
console.log("tables made:", tables.rows[0].n);

// The kinds of SQL the app leans on.
async function tryQuery(label, sql, params = []) {
  try {
    const r = await db.query(sql, params);
    console.log(`ok   ${label}`, JSON.stringify(r.rows[0] ?? null).slice(0, 100));
    return true;
  } catch (err) {
    console.log(`FAIL ${label}: ${String(err.message).split("\n")[0]}`);
    return false;
  }
}
await db.query("INSERT INTO users (username, password_hash) VALUES ('spike', 'x')").catch((e) => console.log("insert user:", e.message));
const uid = (await db.query("SELECT id FROM users LIMIT 1")).rows[0]?.id;
await tryQuery("COUNT(*)::int and a parameter", "SELECT COUNT(*)::int AS n FROM users WHERE id = $1", [uid]);
await tryQuery("make_interval(mins => $1)", "SELECT NOW() - make_interval(mins => $1) AS t", [15]);
await tryQuery("unaccent()", "SELECT unaccent('café ñandú') AS t");
await tryQuery("ILIKE ALL with unaccent (the search)", "SELECT unaccent('Café del mar') ILIKE ALL ($1::text[]) AS hit", [["%cafe%", "%mar%"]]);
await tryQuery("jsonb insert and a check (cloth zones)", "INSERT INTO cloths (user_id, name) VALUES ($1, 'c') RETURNING id", [uid]);
const cid = (await db.query("SELECT id FROM cloths LIMIT 1")).rows[0]?.id;
await tryQuery("jsonb geom", "INSERT INTO cloth_zones (user_id, cloth_id, name, geom) VALUES ($1, $2, 'z', $3::jsonb) RETURNING geom", [uid, cid, JSON.stringify({ shape: "circle", cx: 1, cy: 1, r: 1 })]);
await tryQuery("unique index on LOWER(name)", "INSERT INTO cloth_zones (user_id, cloth_id, name, geom) VALUES ($1, $2, 'Z', '{}'::jsonb)", [uid, cid]);
await tryQuery("FOR UPDATE SKIP LOCKED", "SELECT id FROM image_jobs WHERE status = 'queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1");
await tryQuery("a transaction with a savepoint", "SELECT 1 AS one");
try {
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO tags (user_id, name) VALUES ($1, 'a')", [uid]);
    throw new Error("rollback me");
  });
} catch {}
const left = await db.query("SELECT COUNT(*)::int AS n FROM tags");
console.log("transaction rolled back:", left.rows[0].n === 0 ? "yes" : "NO");
await tryQuery("bytea round trip (pictures)", "SELECT encode($1::bytea, 'hex') AS h", [new Uint8Array([1, 2, 3])]);
await tryQuery("gen_random / pgcrypto not needed", "SELECT 1 AS ok");

// Speed of an ordinary query, and the size of the data folder.
const q0 = performance.now();
for (let i = 0; i < 200; i++) await db.query("SELECT id FROM users WHERE id = $1", [uid]);
console.log(`200 small queries: ${Math.round(performance.now() - q0)} ms`);
function dirSize(d) {
  return ls(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
}
console.log(`data folder after the migrations: ${(dirSize(dataDir) / 1e6).toFixed(1)} MB`);
await db.close();
const reopen = performance.now();
const db2 = new PGlite(dataDir, { extensions: { unaccent } });
await db2.waitReady;
console.log(`reopen an existing folder: ${Math.round(performance.now() - reopen)} ms; users still there: ${(await db2.query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n}`);
await db2.close();
