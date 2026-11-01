// A spike, kept so it can be run again (open item ED8, docs/spike-local-database.md): run the app's real database functions against PGlite
// (Postgres inside Node) instead of Neon. It touches no real database. PGlite is NOT a dependency of the project: install it in a scratch folder,
//   mkdir %TEMP%\pglite && cd %TEMP%\pglite && npm init -y && npm i @electric-sql/pglite
// then, from the project folder (with DATABASE_URL unset):
//   npx tsx scripts/spikes/pglite-app-spike.mts <project folder> <the scratch folder>
// lib/db.ts takes its pool from globalThis.__stationPool when one is there, so a pool-shaped adapter over PGlite is all it takes.
import { pathToFileURL } from "node:url";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.argv[2];
const pglitePath = process.argv[3];
const { PGlite } = await import(pathToFileURL(join(pglitePath, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const { unaccent } = await import(pathToFileURL(join(pglitePath, "node_modules/@electric-sql/pglite/dist/contrib/unaccent.js")).href);

const db = new PGlite(mkdtempSync(join(tmpdir(), "pglite-app-")), { extensions: { unaccent } });
await db.waitReady;
for (const f of readdirSync(join(root, "migrations")).filter((f: string) => /^\d+_.*\.sql$/.test(f)).sort()) await db.exec(readFileSync(join(root, "migrations", f), "utf8"));

// A pool-shaped adapter: one connection at a time (a lease that is held until release), because PGlite has one session.
let tail: Promise<void> = Promise.resolve();
const pool = {
  async connect() {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const ready = tail;
    tail = ready.then(() => gate);
    await ready;
    return {
      query: (sql: string, params?: unknown[]) => db.query(sql, params as any[]),
      release: () => release(),
      on() {},
      removeListener() {},
    };
  },
  on() {},
  async end() {},
};
(globalThis as any).__stationPool = pool;

process.env.SESSION_SECRET = "spike-secret-spike-secret-spike-secret";
const { createUser, getUserById } = await import("../../lib/auth");
const { createCloth, loadCloth, listCloths, savePlacements, zoneCounts } = await import("../../lib/cloths");
const { query, queryOne, withTransaction } = await import("../../lib/db");

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) fails++; console.log(c ? "ok  " : "FAIL", m); };

const user = await createUser("spike-user", "Spike", "a-long-enough-password");
ok(!!user?.id, "createUser (bcrypt, a transaction-free insert, starter layouts)");
const again = await getUserById(user.id);
ok(again?.username === "spike-user", "read the user back");
const id = await createCloth(user.id, { name: "Spike cloth", description: null, zones: [{ name: "Heart", note: null, color: null, geom: { shape: "circle", cx: 500, cy: 500, r: 100 } }] });
ok(!!id, "createCloth in a transaction with jsonb");
const cloth = await loadCloth(user.id, id!);
ok(cloth?.zones[0].geom.shape === "circle", "loadCloth reads the jsonb geometry back as an object");
ok((await listCloths(user.id)).length === 1, "listCloths with a sub-select count");
await query("INSERT INTO divinations (user_id, kind, summary) VALUES ($1, 'runes', 'x')", [user.id]);
const d = await queryOne<{ id: number }>("SELECT id FROM divinations WHERE user_id = $1", [user.id]);
await query("INSERT INTO rune_draws (user_id, divination_id, rune_id, rune_name, sort_order) VALUES ($1, $2, 'rune-fehu', 'Fehu', 0)", [user.id, d!.id]);
await savePlacements(user.id, d!.id, { id: id!, name: "Spike cloth" }, [{ index: 0, label: "Fehu" }], [{ index: 0, where: "zone", zone: "Heart", x: 500, y: 500, facing: "up", simulated: false }]);
const counts = await zoneCounts(user.id, id!);
ok(counts.counts[0]?.zone_name === "Heart" && counts.counts[0].n === 1, "placements and group-by counts");
let rolled = false;
try {
  await withTransaction(async (c) => { await c.query("INSERT INTO tags (user_id, name) VALUES ($1, 'x')", [user.id]); throw new Error("no"); });
} catch { rolled = true; }
ok(rolled && (await query("SELECT 1 FROM tags WHERE user_id = $1", [user.id])).length === 0, "withTransaction rolls back");
// Several requests at once, as a page asks for many things: every one must get its own answer.
const many = await Promise.all(Array.from({ length: 20 }, (_, i) => queryOne<{ n: number }>("SELECT $1::int AS n", [i])));
ok(many.every((r, i) => r?.n === i), "20 queries started at once each get their own answer");
const { searchEverything } = await import("../../lib/search").catch(() => ({ searchEverything: null as any }));
console.log(searchEverything ? "search module loaded" : "(search entry point not named searchEverything; skipped)");
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(0);
