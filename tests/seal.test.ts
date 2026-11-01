// Checks on the locked (sealed) data of a local copy (docs/plan-feathered-edition.md 4.2): the file format (lib/seal-core.ts), and a real database turned
// from memory to sealed, locked, opened with the password and with a recovery code, and turned back into a folder (lib/local-db.ts, lib/seal.ts).
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  isSealed,
  isSealedArt,
  makeHeader,
  newDataKey,
  openArt,
  openSealed,
  readHeader,
  replaceHeader,
  sealArt,
  sealBytes,
  unwrapKey,
  withCodes,
  withPassphrase,
} from "../lib/seal-core";
import { makeLocalPool, changesData } from "../lib/local-db";
import {
  forgetKey,
  isLocked,
  passwordChanged,
  recoveryCodeUsed,
  sealPathFor,
  unlockWithCode,
  unlockWithPassphrase,
} from "../lib/seal";

const FAST = { N: 2 ** 10, r: 8, p: 1 };

test("the sealed file opens with the passphrase or a recovery code, however the code is typed, and with nothing else", () => {
  const dk = newDataKey();
  const header = makeHeader(dk, "correct horse battery", ["K7QM-2XPD-9TWR", "AAAA-BBBB-CCCC"], FAST);
  const file = sealBytes(header, dk, Buffer.from("the whole database"));
  assert.ok(isSealed(file));
  assert.ok(!file.includes(Buffer.from("the whole database")), "nothing readable inside");
  const read = readHeader(file);
  assert.deepEqual(unwrapKey(read, "correct horse battery", "pass"), dk);
  assert.equal(unwrapKey(read, "correct horse batter", "pass"), null);
  assert.equal(unwrapKey(read, "K7QM-2XPD-9TWR", "pass"), null, "a code is not a passphrase");
  assert.deepEqual(unwrapKey(read, "k7qm 2xpd 9twr", "code"), dk);
  assert.equal(unwrapKey(read, "", "pass"), null);
  assert.equal(openSealed(file, dk).toString(), "the whole database");
  assert.throws(() => openSealed(file, newDataKey()), "a wrong key opens nothing");
  const changed = Buffer.from(file);
  changed[changed.length - 3] ^= 1;
  assert.throws(() => openSealed(changed, dk), "one changed byte is found");
  assert.throws(() => readHeader(Buffer.from("not sealed at all")));
});

test("a new passphrase or a new set of codes changes only the header: the old ones stop working and the body still opens", () => {
  const dk = newDataKey();
  const header = makeHeader(dk, "old passphrase here", ["AAAA-BBBB-CCCC"], FAST);
  const file = sealBytes(header, dk, Buffer.from("body"));
  const next = withCodes(withPassphrase(header, dk, "new passphrase here"), dk, ["DDDD-EEEE-FFFF"]);
  const rewritten = replaceHeader(file, next);
  const read = readHeader(rewritten);
  assert.equal(unwrapKey(read, "old passphrase here", "pass"), null);
  assert.equal(unwrapKey(read, "AAAA-BBBB-CCCC", "code"), null);
  assert.deepEqual(unwrapKey(read, "new passphrase here", "pass"), dk);
  assert.deepEqual(unwrapKey(read, "DDDD-EEEE-FFFF", "code"), dk);
  assert.equal(openSealed(rewritten, dk).toString(), "body");
});

test("pictures: sealed with the key, opened with it; a plain file is read as it is; a locked one is refused", () => {
  const dk = newDataKey();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  const sealed = sealArt(dk, png);
  assert.ok(isSealedArt(sealed) && !isSealedArt(png));
  assert.deepEqual(openArt(dk, sealed), png);
  assert.deepEqual(openArt(null, png), png);
  assert.throws(() => openArt(null, sealed));
});

test("only statements that can change data mark a locked copy for saving", () => {
  for (const s of ["SELECT 1", "  select * from x", "BEGIN", "COMMIT", "ROLLBACK", "SET x = 1"]) assert.equal(changesData(s), false, s);
  for (const s of ["INSERT INTO x VALUES (1)", "UPDATE x SET a = 1", "DELETE FROM x", "WITH a AS (DELETE FROM x RETURNING 1) SELECT 1"]) assert.equal(changesData(s), true, s);
});

test("a real database: a new Feathered copy in memory is sealed, saved, locked, opened with the password or a code, and opened into a folder again", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "seal-"));
  const dir = path.join(root, "my-data", "database");
  const art = path.join(root, "my-data", "pictures");
  mkdirSync(path.join(art, "1"), { recursive: true });
  const picture = Buffer.from("a picture's bytes, long enough to be one");
  writeFileSync(path.join(art, "1", "pic.png"), picture);
  const before = process.env.DS_DB_DIR;
  process.env.DS_DB_DIR = dir;
  const pool = makeLocalPool(dir, undefined, true);
  const run = async <T>(sql: string, params: unknown[] = []) => {
    const c = await pool.connect();
    try { return (await c.query(sql, params)).rows as T[]; } finally { c.release(); }
  };
  const names = async () => (await run<{ username: string }>("SELECT username FROM users ORDER BY id")).map((r) => r.username);
  try {
    await run("INSERT INTO users (username, password_hash, is_admin) VALUES ('first', 'x', 1)");
    assert.equal(pool.mode(), "memory");
    assert.ok(!existsSync(path.join(dir, "PG_VERSION")), "nothing is written before set-up decides");

    await pool.makeSealed("first passphrase!", ["AAAA-BBBB-CCCC"], 1, art);
    const sealPath = sealPathFor(dir);
    assert.equal(sealPath, path.join(root, "my-data", "feathered.sealed"));
    assert.ok(existsSync(sealPath));
    assert.ok(!existsSync(dir), "no data folder");
    assert.ok(isSealedArt(readFileSync(path.join(art, "1", "pic.png"))), "the picture beside it is sealed");
    assert.deepEqual(await names(), ["first"]);

    await run("INSERT INTO users (username, password_hash, is_admin) VALUES ('second', 'x', 0)");
    assert.equal(pool.unsaved(), true);
    assert.equal(await pool.saveNow(), true);
    assert.ok(existsSync(`${sealPath}.previous`), "the file before the last save is kept");

    await run("INSERT INTO users (username, password_hash, is_admin) VALUES ('third', 'x', 0)");
    assert.equal(await pool.lockNow(), true, "locking saves first");
    assert.ok(isLocked());
    await assert.rejects(() => pool.connect(), /locked/);
    assert.equal(unlockWithPassphrase("wrong passphrase"), false);
    assert.equal(unlockWithPassphrase("first passphrase!"), true);
    assert.deepEqual(await names(), ["first", "second", "third"], "everything up to the lock is there");

    // A new password becomes the passphrase; the old one stops working.
    passwordChanged(1, "second passphrase");
    await pool.lockNow();
    assert.equal(unlockWithPassphrase("first passphrase!"), false);
    assert.equal(unlockWithCode("aaaa-bbbb-cccc"), true, "a recovery code opens it");
    recoveryCodeUsed("AAAA-BBBB-CCCC");
    await pool.lockNow();
    assert.equal(unlockWithCode("AAAA-BBBB-CCCC"), false, "a used code no longer does");
    assert.equal(unlockWithPassphrase("second passphrase"), true);

    // Turning the lock off: an ordinary folder again, plain files beside it, no sealed file.
    await pool.makeFolder(art);
    assert.equal(pool.mode(), "folder");
    assert.ok(existsSync(path.join(dir, "PG_VERSION")));
    assert.ok(!existsSync(sealPath) && !existsSync(`${sealPath}.previous`));
    assert.deepEqual(readFileSync(path.join(art, "1", "pic.png")), picture);
    assert.equal(isLocked(), false);
    assert.deepEqual(await names(), ["first", "second", "third"]);
    assert.ok(!readdirSync(path.dirname(dir)).some((n) => n.includes("before-unlock")), "nothing was in the way");
  } finally {
    await pool.end().catch(() => {});
    forgetKey();
    process.env.DS_DB_DIR = before;
  }
});
