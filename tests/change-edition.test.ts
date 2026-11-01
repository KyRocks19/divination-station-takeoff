// Checks on the upgrade file that moves a portable copy between Feathered and Winged in place (scripts/change-edition.mjs). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(__dirname, "..", "scripts", "change-edition.mjs");

/** A pretend unzipped copy: an app folder, a start file, a VERSION.txt naming its edition, and optionally the person's data and settings. */
function makeCopy(dir: string, edition: "Feathered" | "Winged", withData = false, version?: string) {
  mkdirSync(path.join(dir, "app"), { recursive: true });
  writeFileSync(path.join(dir, "app", "server.js"), `// ${edition} server${version ? ` ${version}` : ""}\n`);
  cpSync(script, path.join(dir, "app", "change-edition.mjs"));
  // A folder built before VERSION.txt named the version has no number after the name.
  const name = version ? `Divination Station ${version},` : "Divination Station,";
  writeFileSync(path.join(dir, "VERSION.txt"), edition === "Feathered" ? `${name} Feathered edition (linux-x64)\n` : `${name} Winged edition (the full local edition) (linux-x64)\n`);
  writeFileSync(path.join(dir, "start-divination-station.sh"), `# ${edition}\n`);
  if (edition === "Winged") writeFileSync(path.join(dir, "HOSTING.md"), "hosting\n");
  if (withData) {
    mkdirSync(path.join(dir, "my-data", "database"), { recursive: true });
    writeFileSync(path.join(dir, "my-data", "database", "PG_VERSION"), "17\n");
    writeFileSync(path.join(dir, "settings.env"), "PORT=1\n");
  }
}

const run = (from: string, target: string, ...flags: string[]) =>
  spawnSync(process.execPath, [path.join(from, "app", "change-edition.mjs"), target, "--yes", ...flags], { encoding: "utf8", timeout: 20_000 });

test("Feathered moves to Winged in place: the app is replaced, the data and settings stay, and a copy of the data is kept", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ds-edition-"));
  try {
    const winged = path.join(root, "winged");
    const drive = path.join(root, "drive");
    makeCopy(winged, "Winged");
    makeCopy(drive, "Feathered", true);
    const r = run(winged, drive);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(readFileSync(path.join(drive, "VERSION.txt"), "utf8"), /Winged edition/);
    assert.match(readFileSync(path.join(drive, "app", "server.js"), "utf8"), /Winged server/);
    assert.ok(existsSync(path.join(drive, "HOSTING.md")));
    assert.equal(readFileSync(path.join(drive, "my-data", "database", "PG_VERSION"), "utf8"), "17\n");
    assert.equal(readFileSync(path.join(drive, "settings.env"), "utf8"), "PORT=1\n");
    const kept = readdirSync(drive).filter((n) => n.startsWith("my-data.before-winged-"));
    assert.equal(kept.length, 1);
    assert.ok(existsSync(path.join(drive, kept[0], "database", "PG_VERSION")));
    assert.ok(!existsSync(path.join(drive, ".changing-edition")));

    // And back: the Winged-only guide goes, the data stays.
    const feathered = path.join(root, "feathered");
    makeCopy(feathered, "Feathered");
    const back = run(feathered, drive);
    assert.equal(back.status, 0, back.stderr + back.stdout);
    assert.match(readFileSync(path.join(drive, "VERSION.txt"), "utf8"), /Feathered edition/);
    assert.ok(!existsSync(path.join(drive, "HOSTING.md")));
    assert.equal(readFileSync(path.join(drive, "my-data", "database", "PG_VERSION"), "utf8"), "17\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("it refuses a folder that is not a copy, its own folder, and a copy whose data a live process holds", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ds-edition-"));
  try {
    const winged = path.join(root, "winged");
    makeCopy(winged, "Winged");
    const empty = path.join(root, "empty");
    mkdirSync(empty);
    assert.notEqual(run(winged, empty).status, 0);
    assert.notEqual(run(winged, winged).status, 0);

    const drive = path.join(root, "drive");
    makeCopy(drive, "Feathered", true);
    // This test's own process is alive, so its pid in the lock means "running".
    writeFileSync(path.join(drive, "my-data", "database.lock"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const r = run(winged, drive);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /running/);
    assert.match(readFileSync(path.join(drive, "VERSION.txt"), "utf8"), /Feathered edition/, "nothing was changed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an update brings a copy of the same edition to the new version in place: the app is replaced, the data and settings stay, a copy is kept", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ds-update-"));
  try {
    const download = path.join(root, "new");
    const copy = path.join(root, "copy");
    makeCopy(download, "Winged", false, "0.2.0");
    makeCopy(copy, "Winged", true, "0.1.0");
    const r = run(download, copy, "--update");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(readFileSync(path.join(copy, "VERSION.txt"), "utf8"), /^Divination Station 0\.2\.0, Winged edition/);
    assert.match(readFileSync(path.join(copy, "app", "server.js"), "utf8"), /0\.2\.0/);
    assert.equal(readFileSync(path.join(copy, "my-data", "database", "PG_VERSION"), "utf8"), "17\n");
    assert.equal(readFileSync(path.join(copy, "settings.env"), "utf8"), "PORT=1\n");
    const kept = readdirSync(copy).filter((n) => n.startsWith("my-data.before-update-0.1.0-"));
    assert.equal(kept.length, 1);
    assert.ok(existsSync(path.join(copy, kept[0], "database", "PG_VERSION")));

    // The same version again: nothing to do.
    const again = run(download, copy, "--update");
    assert.equal(again.status, 0, again.stderr + again.stdout);
    assert.match(again.stdout, /already has version 0\.2\.0/);
    assert.equal(readdirSync(copy).filter((n) => n.startsWith("my-data.before-")).length, 1, "no second copy of the data");

    // A copy built before VERSION.txt named its version is updated too.
    const unnamed = path.join(root, "unnamed");
    makeCopy(unnamed, "Winged", true);
    const old = run(download, unnamed, "--update");
    assert.equal(old.status, 0, old.stderr + old.stdout);
    assert.match(readFileSync(path.join(unnamed, "VERSION.txt"), "utf8"), /0\.2\.0/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an update refuses the other edition, and nothing puts an older version over a newer one", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ds-update-"));
  try {
    const feathered = path.join(root, "feathered");
    const winged = path.join(root, "winged");
    makeCopy(feathered, "Feathered", false, "0.2.0");
    makeCopy(winged, "Winged", true, "0.1.0");
    const other = run(feathered, winged, "--update");
    assert.notEqual(other.status, 0);
    assert.match(other.stderr, /Winged edition[^]*switch-a-winged-copy-to-feathered/);
    assert.match(readFileSync(path.join(winged, "VERSION.txt"), "utf8"), /0\.1\.0, Winged/, "nothing was changed");

    const older = path.join(root, "older");
    const newer = path.join(root, "newer");
    makeCopy(older, "Winged", false, "0.1.0");
    makeCopy(newer, "Winged", true, "0.10.0");
    for (const flags of [["--update"], []]) {
      const r = run(older, newer, ...flags);
      assert.notEqual(r.status, 0, `refused with ${flags.join(" ") || "no flags"}`);
      assert.match(r.stderr, /0\.10\.0, which is newer than this download \(0\.1\.0\)/, "versions compare as numbers, not as text");
    }
    assert.match(readFileSync(path.join(newer, "VERSION.txt"), "utf8"), /0\.10\.0/, "nothing was changed");
    assert.deepEqual(readdirSync(newer).filter((n) => n.startsWith("my-data.before-")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the packaging writes an update file for both editions and the version into VERSION.txt", () => {
  const build = readFileSync(path.join(__dirname, "..", "scripts", "build-local-package.ts"), "utf8");
  assert.match(build, /\["update-a-copy", "--update "\]/);
  assert.match(build, /VERSION\.txt"\), `Divination Station \$\{version\}, /);
  assert.match(build, /"UPGRADING\.md"/);
});
