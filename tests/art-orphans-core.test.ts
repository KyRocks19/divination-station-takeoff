import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyArtFile, compareArt, oldEnough } from "../lib/art-orphans-core";

const U1 = "12/3f2a1b4c-0000-4000-8000-000000000001";
const U2 = "12/3f2a1b4c-0000-4000-8000-000000000002";
const U3 = "7/3f2a1b4c-0000-4000-8000-000000000003";

test("a file is judged by its name alone", () => {
  assert.deepEqual(classifyArtFile(`${U1}.png`), { kind: "picture", key: `${U1}.png` });
  assert.deepEqual(classifyArtFile(`${U1}.json`), { kind: "picture", key: `${U1}.json` });
  assert.deepEqual(classifyArtFile(`${U1}.png.thumb.webp`), { kind: "thumb", key: `${U1}.png` });
  assert.deepEqual(classifyArtFile(`${U1}.webp.part`), { kind: "part" });
  for (const odd of ["notes.txt", "12/readme.md", "_orphans/12/x.png", `${U1}.gif`, `../${U1}.png`, "12/3f2a.png"]) {
    assert.equal(classifyArtFile(odd).kind, "other", odd);
  }
});

test("a file is a stray only when no database has a row for it", () => {
  const files = [`${U1}.png`, `${U2}.png`, `${U3}.jpg`];
  const dev = [`${U1}.png`];
  const live = [`${U2}.png`];
  const r = compareArt(files, [dev, live]);
  assert.deepEqual(r.strays, [`${U3}.jpg`]);
  assert.equal(r.pictures, 3);
  // Reading only the dev branch would wrongly call live's picture a stray: the report is only as good as the databases given.
  assert.deepEqual(compareArt(files, [dev]).strays, [`${U2}.png`, `${U3}.jpg`].sort());
});

test("rows whose file is gone are listed per database", () => {
  const r = compareArt([`${U1}.png`], [[`${U1}.png`, `${U2}.png`], [`${U3}.jpg`]]);
  assert.deepEqual(r.missing, [[`${U2}.png`], [`${U3}.jpg`]]);
  assert.deepEqual(r.strays, []);
});

test("previews follow their picture; half-written and unknown files are listed and never counted as pictures", () => {
  const r = compareArt([`${U1}.png`, `${U1}.png.thumb.webp`, `${U2}.png.thumb.webp`, `${U2}.png.part`, "notes.txt"], [[`${U1}.png`]]);
  assert.deepEqual(r.strayThumbs, [`${U2}.png.thumb.webp`]);
  assert.deepEqual(r.parts, [`${U2}.png.part`]);
  assert.deepEqual(r.other, ["notes.txt"]);
  assert.equal(r.pictures, 1);
});

test("a folder and databases that agree report nothing", () => {
  const r = compareArt([`${U1}.png`, `${U1}.png.thumb.webp`], [[`${U1}.png`], [`${U1}.png`]]);
  assert.deepEqual([r.strays, r.strayThumbs, r.parts, r.other, ...r.missing], [[], [], [], [], [], []]);
});

test("only files a day old are moved", () => {
  const now = Date.UTC(2026, 9, 18, 12);
  assert.equal(oldEnough(now - 3_600_000, now), false);
  assert.equal(oldEnough(now - 25 * 3_600_000, now), true);
  assert.equal(oldEnough(now - 25 * 3_600_000, now, 48), false);
});
