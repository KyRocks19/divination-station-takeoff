import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupFileName, fieldsWithoutColumn, filesToKeep, filesToRemove, hostOf, newerThanThisCopy, parseBackupName, sslFor, tableOrder } from "../lib/backup-format";

test("fields of a backed-up row with no column in the target are listed, so a restore cannot lose them quietly", () => {
  assert.deepEqual(fieldsWithoutColumn(["id", "username", "seeker_config", "ai_provider"], ["id", "username"]), ["ai_provider", "seeker_config"]);
  assert.deepEqual(fieldsWithoutColumn(["id"], ["id", "newer_column"]), []);
});

test("tables come after the tables they point to, the same way every time", () => {
  const order = tableOrder(
    ["journals", "readings", "users", "divinations", "tags"],
    [
      { child: "readings", parent: "users" },
      { child: "divinations", parent: "readings" },
      { child: "journals", parent: "divinations" },
      { child: "journals", parent: "readings" },
      { child: "tags", parent: "users" },
      { child: "users", parent: "users" }, // a table pointing at itself is ignored
    ]
  );
  assert.deepEqual(order, ["users", "readings", "tags", "divinations", "journals"]);
});

test("tables that point at each other in a circle are reported", () => {
  assert.throws(() => tableOrder(["a", "b"], [{ child: "a", parent: "b" }, { child: "b", parent: "a" }]), /circle/);
});

test("a backup file name round-trips to the time it was made", () => {
  const when = new Date(2026, 9, 13, 9, 5);
  assert.equal(backupFileName(when), "divination-station-2026-10-13-0905.jsonl.gz");
  assert.equal(parseBackupName("divination-station-2026-10-13-0905.jsonl.gz")?.getTime(), when.getTime());
  assert.equal(parseBackupName("notes.txt"), null);
  assert.equal(parseBackupName("divination-station-2026-10-13-0905.jsonl.gz.part"), null);
});

test("old backups are removed but the newest and one per week stay; other files are never listed", () => {
  const names: string[] = [];
  // 30 days of daily backups ending 2026-10-13
  for (let d = 0; d < 30; d++) names.push(backupFileName(new Date(2026, 9, 13 - d, 3, 0)));
  names.push("readme.txt", "art");
  const keep = filesToKeep(names, 7, 3);
  assert.ok(keep.has(backupFileName(new Date(2026, 9, 13, 3, 0)))); // newest
  assert.ok(keep.has(backupFileName(new Date(2026, 9, 7, 3, 0)))); // 7th newest
  assert.ok(!keep.has(backupFileName(new Date(2026, 9, 5, 3, 0)))); // 9th newest, but the newest of its week? (see below)
  const removed = filesToRemove(names, 7, 3);
  assert.ok(!removed.includes("readme.txt") && !removed.includes("art"));
  assert.ok(removed.length > 0 && removed.length < 30);
  // Nothing is removed when there are fewer files than the limit.
  assert.deepEqual(filesToRemove(names.slice(0, 5), 7, 3), []);
});

test("one file per calendar week is kept beyond the recent ones", () => {
  // Weeks start on Monday: 09-14 and 09-16 are one week, 09-21, 09-23 and 09-27 (a Sunday) the next, 10-01 the next, 10-13 the last.
  const make = (m: number, d: number) => backupFileName(new Date(2026, m, d, 3, 0));
  const names = [make(8, 14), make(8, 16), make(8, 21), make(8, 23), make(8, 27), make(9, 1), make(9, 13)];
  const keep = filesToKeep(names, 1, 4);
  assert.deepEqual([...keep].sort(), [make(8, 16), make(8, 27), make(9, 1), make(9, 13)].sort());
});

test("the host is shown without the password, and a database on this computer needs no secure connection", () => {
  assert.equal(hostOf("postgresql://user:secret@ep-example-123.us-east-2.aws.neon.tech/db?sslmode=require"), "ep-example-123.us-east-2.aws.neon.tech");
  assert.equal(hostOf(undefined), "(none)");
  assert.equal(hostOf("not a url"), "(unreadable address)");
  assert.deepEqual(sslFor("postgresql://u:p@ep-x.neon.tech/db"), { rejectUnauthorized: true });
  assert.equal(sslFor("postgresql://u:p@localhost:5432/db"), false);
  assert.equal(sslFor("postgresql://u:p@127.0.0.1:5432/db"), false);
});

test("a move to a local folder stops when the backup had migrations this copy does not have", () => {
  assert.deepEqual(newerThanThisCopy(["001_a.sql", "106_b.sql"], ["001_a.sql", "105_c.sql"]), ["106_b.sql"]);
  // A copy with more migrations than the backup is fine: the new folder gets them.
  assert.deepEqual(newerThanThisCopy(["001_a.sql"], ["001_a.sql", "105_c.sql"]), []);
});

test("the restore and the local move share one restore, and the move never connects to a database server", () => {
  const restore = readFileSync("scripts/restore-db.ts", "utf8");
  const move = readFileSync("scripts/neon-to-local.ts", "utf8");
  assert.match(restore, /restoreInto\(/);
  assert.match(move, /restoreInto\(/);
  assert.doesNotMatch(move, /from "pg"/);
  assert.doesNotMatch(move, /process\.env\.DATABASE_URL/);
});
