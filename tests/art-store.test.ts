import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { artDir, artFileExists, bytesOfRow, deleteArt, diskRequiredButMissing, extFor, placeBytes, readArt, validKey, writeArt } from "../lib/art-store";

const UUID = "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607";

test("only keys of the shape this app makes are valid, and they belong to one person", () => {
  assert.equal(validKey(`12/${UUID}.png`), true);
  assert.equal(validKey(`12/${UUID}.png`, 12), true);
  assert.equal(validKey(`12/${UUID}.png`, 13), false);
  for (const bad of [
    `../${UUID}.png`, `12/../${UUID}.png`, `12/${UUID}.svg`, `12/${UUID}.png/x`, `12\\${UUID}.png`,
    `/etc/passwd`, `12/${UUID.toUpperCase()}.png`, `12/not-a-uuid.png`, "", null, undefined, 5,
  ]) assert.equal(validKey(bad as any), false, String(bad));
});

test("file types follow the picture's type", () => {
  assert.equal(extFor("image/jpeg"), "jpg");
  assert.equal(extFor("image/webp"), "webp");
  assert.equal(extFor("image/png"), "png");
});

test("pictures are written, read, and deleted inside ART_DIR, and stay with their owner", async () => {
  const before = process.env.ART_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "art-test-"));
  try {
    process.env.ART_DIR = dir;
    assert.equal(artDir(), path.resolve(dir));

    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const key = await writeArt(7, bytes, "png");
    assert.match(key, /^7\/[0-9a-f-]{36}\.png$/);
    assert.ok(existsSync(path.join(dir, key)));
    assert.deepEqual(readdirSync(path.join(dir, "7")).filter((f) => f.endsWith(".part")), [], "no half-written file is left behind");

    assert.deepEqual(await readArt(key, 7), bytes);
    assert.equal(await artFileExists(key, 7), true);
    // Another person's id cannot read it, and a key that climbs out of the folder is refused.
    assert.equal(await readArt(key, 8), null);
    assert.equal(await readArt(`7/../../x.png`, 7), null);

    // placeBytes uses the file when ART_DIR is set; bytesOfRow reads either place.
    const placed = await placeBytes(7, bytes, "image/png");
    assert.equal(placed.data, null);
    assert.ok(placed.file_key);
    assert.deepEqual(await bytesOfRow({ data: null, file_key: placed.file_key }, 7), bytes);
    assert.deepEqual(await bytesOfRow({ data: bytes, file_key: null }, 7), bytes);
    assert.equal(await bytesOfRow({ data: null, file_key: null }, 7), null);

    await deleteArt([key, placed.file_key, null, undefined, "7/../../x.png", `8/${UUID}.png`], 7);
    assert.equal(await artFileExists(key, 7), false);
    assert.equal(await artFileExists(placed.file_key, 7), false);
    await deleteArt([key], 7); // deleting twice is fine

    // Without ART_DIR the bytes stay in the row and nothing is written.
    delete process.env.ART_DIR;
    assert.equal(artDir(), null);
    const kept = await placeBytes(7, bytes, "image/png");
    assert.deepEqual(kept, { data: bytes, file_key: null });
    await assert.rejects(writeArt(7, bytes, "png"));
  } finally {
    if (before === undefined) delete process.env.ART_DIR;
    else process.env.ART_DIR = before;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ART_REQUIRE_DISK refuses new pictures on a copy of the app that has no ART_DIR", () => {
  const before = { dir: process.env.ART_DIR, req: process.env.ART_REQUIRE_DISK };
  try {
    delete process.env.ART_DIR;
    delete process.env.ART_REQUIRE_DISK;
    assert.equal(diskRequiredButMissing(), false, "off by default: pictures stay in the database");
    process.env.ART_REQUIRE_DISK = "1";
    assert.equal(diskRequiredButMissing(), true, "required but no folder: refuse");
    process.env.ART_DIR = tmpdir();
    assert.equal(diskRequiredButMissing(), false, "required and a folder is set: fine");
  } finally {
    for (const [k, v] of [["ART_DIR", before.dir], ["ART_REQUIRE_DISK", before.req]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
