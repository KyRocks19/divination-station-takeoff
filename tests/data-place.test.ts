// Checks on where a portable copy keeps its data, on the drive or on this computer (lib/data-place.ts, docs/plan-feathered-edition.md 4.3).
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { computerDataDir, dataPlace, holdsData, moveData, writeWhere } from "../lib/data-place";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("the computer's folder is in Documents when there is one, and the data's place is read from the two folders", () => {
  const home = mkdtempSync(path.join(tmpdir(), "home-"));
  assert.equal(computerDataDir(home), path.join(home, "Divination Station"));
  mkdirSync(path.join(home, "Documents"));
  assert.equal(computerDataDir(home), path.join(home, "Documents", "Divination Station"));

  const env = { db: process.env.DS_DB_DIR, drive: process.env.DS_DRIVE_DATA };
  try {
    process.env.DS_DRIVE_DATA = "/drive/my-data";
    process.env.DS_DB_DIR = "/drive/my-data/database";
    assert.equal(dataPlace(), "drive");
    process.env.DS_DB_DIR = "/home/me/Documents/Divination Station/database";
    assert.equal(dataPlace(), "computer");
    delete process.env.DS_DRIVE_DATA;
    assert.equal(dataPlace(), null, "a copy not started from a portable folder cannot choose");
  } finally {
    process.env.DS_DB_DIR = env.db;
    if (env.drive === undefined) delete process.env.DS_DRIVE_DATA;
    else process.env.DS_DRIVE_DATA = env.drive;
  }
});

test("moving copies everything, then removes the originals; the lock and the note stay; the note names the folder", () => {
  const top = mkdtempSync(path.join(tmpdir(), "move-"));
  const from = path.join(top, "drive", "my-data");
  const to = path.join(top, "computer", "Divination Station");
  mkdirSync(path.join(from, "pictures", "1"), { recursive: true });
  writeFileSync(path.join(from, "feathered.sealed"), "sealed bytes");
  writeFileSync(path.join(from, "database.secrets.json"), "{}");
  writeFileSync(path.join(from, "pictures", "1", "a.png"), "picture");
  writeFileSync(path.join(from, "database.lock"), "{}");
  assert.ok(holdsData(from) && !holdsData(to));

  assert.equal(moveData(from, to), 3);
  assert.ok(holdsData(to));
  assert.equal(readFileSync(path.join(to, "pictures", "1", "a.png"), "utf8"), "picture");
  assert.deepEqual(readdirSync(from), ["database.lock"], "only the running app's lock is left behind");
  assert.ok(!existsSync(path.join(to, "database.lock")));

  const before = process.env.DS_DRIVE_DATA;
  try {
    process.env.DS_DRIVE_DATA = from;
    writeWhere(to);
    assert.equal(readFileSync(path.join(from, "where.txt"), "utf8").trim(), to);
    writeWhere(null);
    assert.ok(!existsSync(path.join(from, "where.txt")));
  } finally {
    if (before === undefined) delete process.env.DS_DRIVE_DATA;
    else process.env.DS_DRIVE_DATA = before;
  }
});

test("the start files read the note, and stop with a plain message when its folder is not on this computer", () => {
  const src = read("scripts/build-local-package.ts");
  assert.match(src, /set \/p DS_DATA=<"%~dp0my-data\\\\where\.txt"/);
  assert.match(src, /if not exist "%DS_DATA%\\\\" \(/);
  assert.match(src, /DS_DATA=\$\(head -n 1 "\$HERE\/my-data\/where\.txt"/);
  assert.match(src, /Your data for this copy is kept on another computer/);
  assert.match(read("app/api/local/move/route.ts"), /if \(holdsData\(target\)\)/, "a move never overwrites data that is already there");
});

test("the start files warn when the settings were saved as settings.env.txt", () => {
  const src = read("scripts/build-local-package.ts");
  assert.match(src, /if exist "%~dp0settings\.env\.txt" if not exist "%~dp0settings\.env" echo Found settings\.env\.txt/);
  assert.match(src, /if \[ -f "\$HERE\/settings\.env\.txt" \] && \[ ! -f "\$HERE\/settings\.env" \]/);
  // A bare ( or ) in the echo would end a batch block; & or > would split or redirect the line.
  const line = src.split("\n").find((l) => l.includes("Found settings.env.txt but no settings.env") && l.includes("%~dp0"))!;
  assert.doesNotMatch(line.slice(line.indexOf(" echo ")), /[()&<>|]/);
});
