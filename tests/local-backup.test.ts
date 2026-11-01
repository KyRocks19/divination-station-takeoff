// Checks on backup and restore of a local copy's data folder (open item ED9, slice 3). Runs a real PGlite folder: about ten seconds. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BACKUP_KINDS, KEEP, backupName, backupsDirFor, namesToPrune, parseBackupName, sizeLabel, weeklyDue } from "../lib/local-backup-core";
import { makeLocalPool } from "../lib/local-db";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("backup names say their kind and time, sort by time, and only our own names are read", () => {
  const at = new Date(Date.UTC(2026, 9, 18, 20, 4, 59));
  const name = backupName(at, "manual");
  assert.equal(name, "ds-backup-20261018T200459Z-manual.tar.gz");
  assert.deepEqual(parseBackupName(name), { kind: "manual", madeAt: "2026-10-18T20:04:59.000Z" });
  assert.ok(backupName(new Date(at.getTime() + 1000), "weekly") > name, "later sorts later");
  for (const bad of ["../ds-backup-20261018T200459Z-manual.tar.gz", "ds-backup-20261018T200459Z-manual.tar.gz/../x", "ds-backup-20261018T200459Z-other.tar.gz", "secrets.json", "ds-backup-20261318T200459Z-manual.tar.gz.tmp", "", "C:\\Windows\\win.ini"]) {
    assert.equal(parseBackupName(bad), null, bad);
  }
  assert.equal(backupsDirFor("C:/data/ds/"), "C:/data/ds.backups");
});

test("only the automatic kinds are pruned, oldest first, and a person's own backups never are", () => {
  const mk = (kind: "manual" | "weekly" | "before-restore", day: number) => ({ name: backupName(new Date(Date.UTC(2026, 9, day)), kind), kind, madeAt: new Date(Date.UTC(2026, 9, day)).toISOString() });
  const list = [...Array.from({ length: 9 }, (_, i) => mk("weekly", i + 1)), ...Array.from({ length: 5 }, (_, i) => mk("before-restore", i + 1)), ...Array.from({ length: 12 }, (_, i) => mk("manual", i + 1))];
  const gone = namesToPrune(list);
  assert.equal(gone.length, (9 - (KEEP.weekly as number)) + (5 - (KEEP["before-restore"] as number)));
  assert.ok(gone.every((n) => !n.endsWith("-manual.tar.gz")));
  assert.ok(gone.includes(mk("weekly", 1).name) && gone.includes(mk("weekly", 2).name) && !gone.includes(mk("weekly", 9).name));
  assert.deepEqual([...BACKUP_KINDS], ["manual", "weekly", "before-restore", "before-update"]);
});

test("a weekly backup is due only when there is an account and nothing newer than a week", () => {
  const now = new Date(Date.UTC(2026, 9, 20));
  const day = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
  assert.equal(weeklyDue([], now, false), false, "an empty copy has nothing worth keeping");
  assert.equal(weeklyDue([], now, true), true, "no backup yet");
  assert.equal(weeklyDue([{ kind: "manual", madeAt: day(18) }], now, true), false, "the person made one two days ago");
  assert.equal(weeklyDue([{ kind: "weekly", madeAt: day(10) }], now, true), true);
  assert.equal(weeklyDue([{ kind: "before-restore", madeAt: day(19) }], now, true), true, "a safety copy before a restore does not count as a regular backup");
});

test("sizes read plainly", () => {
  assert.equal(sizeLabel(500), "1 KB");
  assert.equal(sizeLabel(2048), "2 KB");
  assert.equal(sizeLabel(13 * 1024 * 1024 + 400000), "13.4 MB");
});

test("a real folder: dump, add data, restore replaces it, the safety copy undoes it, and a file that is not a backup changes nothing", async () => {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "backup-")), "data");
  const pool = makeLocalPool(dir);
  const run = async <T>(sql: string, params: unknown[] = []) => {
    const c = await pool.connect();
    try { return (await c.query(sql, params)).rows as T[]; } finally { c.release(); }
  };
  const names = async () => (await run<{ username: string }>("SELECT username FROM users ORDER BY id")).map((r) => r.username);
  await run("INSERT INTO users (username, password_hash, is_admin) VALUES ('first', 'x', 1)");
  const archive = await pool.dump();
  assert.ok(archive.length > 1_000_000 && archive[0] === 0x1f && archive[1] === 0x8b, "a gzip archive of the whole folder");

  await run("INSERT INTO users (username, password_hash, is_admin) VALUES ('second', 'x', 0)");
  assert.deepEqual(await names(), ["first", "second"]);

  let safety: Uint8Array | null = null;
  await pool.replace(archive, async (current) => { safety = current; });
  assert.deepEqual(await names(), ["first"], "the restore replaced everything with the backup");
  assert.ok(safety, "the data that was here was handed over to be kept first");
  assert.ok((await run<{ n: string }>("SELECT COUNT(*) AS n FROM archetypes"))[0].n > "0", "the reference data is there after a restore");

  await pool.replace(safety!, async () => {});
  assert.deepEqual(await names(), ["first", "second"], "restoring the safety copy undoes the restore");

  // A file that is not a backup: the restore says so and the data is as it was.
  await assert.rejects(() => pool.replace(new Uint8Array([1, 2, 3, 4, 5]), async () => {}), /could not be opened, so nothing was changed/);
  assert.deepEqual(await names(), ["first", "second"], "nothing changed, and the database still answers");

  // If keeping the safety copy fails, the restore does not start.
  await assert.rejects(() => pool.replace(archive, async () => { throw new Error("disk full"); }), /disk full/);
  assert.deepEqual(await names(), ["first", "second"]);
  assert.ok(existsSync(path.join(dir, "PG_VERSION")));
  await pool.end();
});

test("the routes check who is asking, are for the administrator, and the restore must be confirmed by name", () => {
  for (const f of ["app/api/local/backups/route.ts", "app/api/local/backups/[name]/route.ts", "app/api/local/backups/[name]/restore/route.ts"]) {
    const src = read(f);
    const handlers = src.match(/export async function (GET|POST)/g) ?? [];
    assert.equal((src.match(/if \(!session\.userId\)/g) ?? []).length, handlers.length, `${f}: a sign-in check in every handler`);
    assert.equal((src.match(/if \(!session\.isAdmin\)/g) ?? []).length, handlers.length, `${f}: administrator only`);
    assert.equal((src.match(/if \(!backupsAvailable\(\)\)/g) ?? []).length, handlers.length, `${f}: 404 on a copy with no data folder`);
  }
  assert.match(read("app/api/local/backups/[name]/restore/route.ts"), /body\?\.confirm !== name/);
  assert.match(read("lib/local-backup.ts"), /parseBackupName\(name\)\) return null/, "an address reaches a file only through a backup's name");
});

test("an update that brings new migrations saves the data first, once; a fresh folder and an up-to-date one save nothing", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "update-"));
  const data = path.join(dir, "data");
  const older = path.join(dir, "older-migrations");
  cpSync(path.join(root, "migrations"), older, { recursive: true });
  const newest = readdirSync(older).filter((f) => f.endsWith(".sql")).sort().at(-1)!;
  rmSync(path.join(older, newest));
  const backups = () => (existsSync(backupsDirFor(data)) ? readdirSync(backupsDirFor(data)) : []);

  const first = makeLocalPool(data, older);
  await (await first.connect()).release();
  await first.end();
  assert.deepEqual(backups(), [], "a brand-new folder has nothing to save");

  const updated = makeLocalPool(data, path.join(root, "migrations"));
  await (await updated.connect()).release();
  await updated.end();
  const saved = backups();
  assert.equal(saved.length, 1);
  assert.equal(parseBackupName(saved[0])?.kind, "before-update");

  const again = makeLocalPool(data, path.join(root, "migrations"));
  await (await again.connect()).release();
  await again.end();
  assert.equal(backups().length, 1, "nothing new to apply, so nothing new is saved");
});

test("data a newer version has brought up to date is not opened by an older one, at start or as a restore, and nothing is changed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "newer-"));
  const data = path.join(dir, "data");
  const older = path.join(dir, "older-migrations");
  cpSync(path.join(root, "migrations"), older, { recursive: true });
  // The older version stops just before the newest change that older versions cannot read (an "ok" change after it would not stop it).
  const files = readdirSync(older).filter((f) => f.endsWith(".sql")).sort();
  const newest = files.filter((f) => !/^-- older-versions: ok$/m.test(readFileSync(path.join(older, f), "utf8"))).at(-1)!;
  for (const f of files.slice(files.indexOf(newest))) rmSync(path.join(older, f));
  const query = async <T>(pool: ReturnType<typeof makeLocalPool>, sql: string) => {
    const c = await pool.connect();
    try { return (await c.query(sql)).rows as T[]; } finally { c.release(); }
  };

  // The newer version makes the data and keeps a backup of it.
  const newer = makeLocalPool(data, path.join(root, "migrations"));
  await query(newer, "INSERT INTO users (username, password_hash, is_admin) VALUES ('kept', 'x', 1)");
  const newerArchive = await newer.dump();
  await newer.end();

  // The older version refuses it and says why; the data is as it was.
  const quiet = console.error;
  console.error = () => {};
  try {
    const old = makeLocalPool(data, older);
    await assert.rejects(() => old.connect(), (err: Error) => err.name === "NewerDataError" && err.message.includes(newest) && /Nothing was changed/.test(err.message));
    await assert.rejects(() => old.connect(), /newer version/, "it says so again, every time it is asked");
    await old.end();

    const reopened = makeLocalPool(data, path.join(root, "migrations"));
    assert.deepEqual((await query<{ username: string }>(reopened, "SELECT username FROM users")).map((r) => r.username), ["kept"]);
    await reopened.end();

    // A restore of the newer backup into an older copy is refused, and the older copy's own data stays.
    const elsewhere = makeLocalPool(path.join(dir, "older-data"), older);
    await query(elsewhere, "INSERT INTO users (username, password_hash, is_admin) VALUES ('mine', 'x', 1)");
    await assert.rejects(() => elsewhere.replace(newerArchive, async () => {}), /could not be opened, so nothing was changed \(This data was last used by a newer version/);
    assert.deepEqual((await query<{ username: string }>(elsewhere, "SELECT username FROM users")).map((r) => r.username), ["mine"]);
    await elsewhere.end();
  } finally {
    console.error = quiet;
  }
});

test("a newer change that says older versions can use the data does not stop an older copy, which keeps reading and writing what it knows", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "newer-ok-"));
  const data = path.join(dir, "data");
  const older = path.join(root, "migrations");
  const newer = path.join(dir, "newer-migrations");
  cpSync(older, newer, { recursive: true });
  writeFileSync(path.join(newer, "999_probe_table.sql"), "-- A new table older versions never read.\n-- older-versions: ok\nCREATE TABLE IF NOT EXISTS probe_newer (id SERIAL PRIMARY KEY, note TEXT);\n");
  const query = async <T>(pool: ReturnType<typeof makeLocalPool>, sql: string) => {
    const c = await pool.connect();
    try { return (await c.query(sql)).rows as T[]; } finally { c.release(); }
  };

  const updated = makeLocalPool(data, newer);
  await query(updated, "INSERT INTO users (username, password_hash, is_admin) VALUES ('before', 'x', 1)");
  await query(updated, "INSERT INTO probe_newer (note) VALUES ('newer only')");
  await updated.end();

  // The older version opens it, reads and writes as usual, and leaves the newer table alone.
  const old = makeLocalPool(data, older);
  await query(old, "INSERT INTO users (username, password_hash, is_admin) VALUES ('while-older', 'x', 0)");
  assert.deepEqual((await query<{ username: string }>(old, "SELECT username FROM users ORDER BY id")).map((r) => r.username), ["before", "while-older"]);
  await old.end();

  // Back on the newer version: everything is there, and nothing is applied twice.
  const again = makeLocalPool(data, newer);
  assert.deepEqual((await query<{ username: string }>(again, "SELECT username FROM users ORDER BY id")).map((r) => r.username), ["before", "while-older"]);
  assert.deepEqual((await query<{ note: string }>(again, "SELECT note FROM probe_newer")).map((r) => r.note), ["newer only"]);
  assert.deepEqual((await query<{ older_ok: boolean }>(again, "SELECT older_ok FROM schema_migrations WHERE name = '999_probe_table.sql'")).map((r) => r.older_ok), [true]);
  await again.end();

  // One unmarked newer change among safe ones is enough to stop the older copy, and only that one is named.
  writeFileSync(path.join(newer, "999_zz_unmarked.sql"), "-- A change nobody marked.\nCREATE TABLE IF NOT EXISTS probe_unmarked (id INT);\n");
  const third = makeLocalPool(data, newer);
  await (await third.connect()).release();
  await third.end();
  const quiet = console.error;
  console.error = () => {};
  try {
    const refused = makeLocalPool(data, older);
    await assert.rejects(() => refused.connect(), (err: Error) => err.name === "NewerDataError" && err.message.includes("999_zz_unmarked.sql") && !err.message.includes("999_probe_table.sql"));
    await refused.end();
  } finally {
    console.error = quiet;
  }
});
