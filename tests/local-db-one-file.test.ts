// Checks on the one-file fallback (open item ED22): a drive that cannot hold the database folder (exFAT and FAT32 flash drives on Windows) keeps the
// database in memory and saves it as one file beside the folder. The drive is imitated with a folder PGlite cannot build its files in: a FILE named
// `global` where Postgres needs a folder, so its file layer fails the way the drive's does (an ErrnoError, not a Node error). Runs a real PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SAVE_IDLE_MS, makeLocalPool, oneFilePathFor } from "../lib/local-db";
import { ONE_FILE_NAME } from "../lib/local-db-core";
import { holdsData } from "../lib/data-place";

/** A data folder (DS_DATA) whose `database` folder PGlite cannot use. */
function refusingDrive(): { data: string; db: string } {
  const data = mkdtempSync(path.join(tmpdir(), "ds-onefile-"));
  const db = path.join(data, "database");
  mkdirSync(db);
  writeFileSync(path.join(db, "global"), "not a folder");
  return { data, db };
}

test("a drive that refuses the database folder gets one file instead, and the data is still there after a stop and a start", async () => {
  const { data, db } = refusingDrive();
  const first = makeLocalPool(db, undefined, false);
  const c1 = await first.connect();
  await c1.query("CREATE TABLE one_file_check (note text)");
  await c1.query("INSERT INTO one_file_check VALUES ($1)", ["kept"]);
  c1.release();
  assert.equal(first.mode(), "file");
  assert.equal(first.unsaved(), true, "the change waits for its save");
  await first.end();
  assert.ok(existsSync(oneFilePathFor(db)), "the one file is beside the folder");
  assert.equal(path.basename(oneFilePathFor(db)), ONE_FILE_NAME);
  assert.ok(readdirSync(data).some((n) => n.startsWith("database.unusable-")), "the half-made folder is set aside, not deleted");
  assert.ok(holdsData(data), "a move or set-up sees that the folder holds data");

  const second = makeLocalPool(db, undefined, false);
  const c2 = await second.connect();
  const { rows } = await c2.query("SELECT note FROM one_file_check");
  c2.release();
  assert.equal(second.mode(), "file", "the next start opens the file, not the folder");
  assert.deepEqual(rows, [{ note: "kept" }]);
  await second.end();
});

test("a folder that holds a finished database is never set aside for an empty file", async () => {
  const data = mkdtempSync(path.join(tmpdir(), "ds-onefile-real-"));
  const db = path.join(data, "database");
  const made = makeLocalPool(db, undefined, false);
  (await made.connect()).release();
  assert.equal(made.mode(), "folder", "an ordinary folder stays a folder");
  await made.end();
  assert.ok(existsSync(path.join(db, "global", "pg_control")));
  assert.ok(!existsSync(oneFilePathFor(db)), "no one file for a folder that works");

  // Now the same finished folder cannot be opened (its `base` folder replaced by a file): the error is shown, and nothing is moved or made.
  renameSync(path.join(db, "base"), path.join(data, "base-kept"));
  writeFileSync(path.join(db, "base"), "not a folder");
  const broken = makeLocalPool(db, undefined, false);
  await assert.rejects(broken.connect(), /could not be opened/);
  assert.notEqual(broken.mode(), "file");
  assert.ok(!existsSync(oneFilePathFor(db)), "no empty file in place of the data");
  assert.ok(existsSync(path.join(db, "global", "pg_control")), "the folder is where it was");
  await broken.end();
});

test("locking a one-file copy leaves no plain copy behind, and a change is saved by the timer without a stop", async () => {
  const { db } = refusingDrive();
  const pool = makeLocalPool(db, undefined, false);
  try {
    const c = await pool.connect();
    await c.query("CREATE TABLE timer_check (n int)");
    c.release();
    assert.equal(pool.mode(), "file");
    assert.equal(pool.unsaved(), true);
    await new Promise((resolve) => setTimeout(resolve, SAVE_IDLE_MS + 1500));
    assert.equal(pool.unsaved(), false, "saved a few seconds after the change");
    await pool.makeSealed("a long enough passphrase", ["code-one"], 1, null);
    assert.equal(pool.mode(), "sealed");
    assert.ok(!existsSync(oneFilePathFor(db)) && !existsSync(`${oneFilePathFor(db)}.previous`), "the plain file is gone once the sealed one has everything");
  } finally {
    await pool.end();
  }
});
