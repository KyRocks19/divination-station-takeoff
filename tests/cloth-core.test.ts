// Checks on cloths: the zones, where a point falls, and what a person may send. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CLOTH_SIZE, MAX_ZONES, THROW_MARGIN, angleFrom, area, cleanCloth, cleanGeom, cleanPlacements, cleanZone, contains, defaultGeom, describeGeom,
  fromPercent, landing, landingWords, randomPlace, toPercent, ZONE_SHAPES, type Geom, type Zone,
} from "../lib/cloth-core";

const zone = (name: string, geom: Geom): Zone => ({ name, note: null, color: null, geom });

test("a circle, a ring and a rectangle hold the points inside them, edge included", () => {
  const c: Geom = { shape: "circle", cx: 500, cy: 500, r: 100 };
  assert.ok(contains(c, 500, 500) && contains(c, 600, 500) && !contains(c, 601, 500));
  const ring: Geom = { shape: "ring", cx: 500, cy: 500, r: 300, ri: 100 };
  assert.ok(!contains(ring, 500, 500), "the middle of a ring is not in it");
  assert.ok(contains(ring, 700, 500) && contains(ring, 600, 500) && contains(ring, 800, 500) && !contains(ring, 801, 500) && !contains(ring, 599, 500));
  const rect: Geom = { shape: "rectangle", x: 100, y: 200, w: 300, h: 100 };
  assert.ok(contains(rect, 100, 200) && contains(rect, 400, 300) && !contains(rect, 401, 300) && !contains(rect, 250, 301));
});

test("a half is the part of the cloth between an edge and a line", () => {
  assert.ok(contains({ shape: "half", edge: "left", at: 500 }, 0, 900) && contains({ shape: "half", edge: "left", at: 500 }, 500, 0) && !contains({ shape: "half", edge: "left", at: 500 }, 501, 0));
  assert.ok(contains({ shape: "half", edge: "right", at: 300 }, 1000, 5) && contains({ shape: "half", edge: "right", at: 300 }, 700, 5) && !contains({ shape: "half", edge: "right", at: 300 }, 699, 5));
  assert.ok(contains({ shape: "half", edge: "top", at: 400 }, 999, 400) && !contains({ shape: "half", edge: "top", at: 400 }, 999, 401));
  assert.ok(contains({ shape: "half", edge: "bottom", at: 400 }, 1, 600) && !contains({ shape: "half", edge: "bottom", at: 400 }, 1, 599));
});

test("a wedge counts degrees from straight up, clockwise, and can cross the top", () => {
  assert.equal(Math.round(angleFrom(500, 500, 500, 400)), 0, "straight up is 0");
  assert.equal(Math.round(angleFrom(500, 500, 600, 500)), 90, "to the right is 90");
  assert.equal(Math.round(angleFrom(500, 500, 500, 600)), 180);
  assert.equal(Math.round(angleFrom(500, 500, 400, 500)), 270);
  const right: Geom = { shape: "wedge", cx: 500, cy: 500, r: 200, start: 45, sweep: 90 };
  assert.ok(contains(right, 600, 500) && !contains(right, 500, 400) && !contains(right, 500, 600) && !contains(right, 900, 500), "to the right, within the radius");
  const top: Geom = { shape: "wedge", cx: 500, cy: 500, r: 200, start: 350, sweep: 20 };
  assert.ok(contains(top, 500, 400) && contains(top, 515, 400) && contains(top, 490, 400), "a wedge that crosses 0 degrees holds points on both sides of straight up");
  assert.ok(!contains(top, 520, 400) && !contains(top, 480, 400) && !contains(top, 600, 500), "and not those outside its width");
  assert.ok(contains(right, 500, 500), "the centre is in the wedge");
});

test("a freehand zone is a polygon", () => {
  const tri: Geom = { shape: "freehand", points: [[100, 100], [900, 100], [500, 900]] };
  assert.ok(contains(tri, 500, 300) && !contains(tri, 100, 900) && !contains(tri, 950, 100));
  const l: Geom = { shape: "freehand", points: [[0, 0], [600, 0], [600, 200], [200, 200], [200, 600], [0, 600]] };
  assert.ok(contains(l, 100, 500) && contains(l, 500, 100) && !contains(l, 500, 500), "an L shape has a hollow corner");
  assert.equal(area(tri), 800 * 800 / 2);
});

test("an item belongs to the smallest zone that holds it, and is told which others also do", () => {
  const zones = [zone("whole", { shape: "rectangle", x: 0, y: 0, w: 1000, h: 1000 }), zone("middle", { shape: "circle", cx: 500, cy: 500, r: 200 }), zone("heart", { shape: "circle", cx: 500, cy: 500, r: 50 })];
  const a = landing(zones, 500, 500);
  assert.ok(a.kind === "zone" && a.zone.name === "heart" && a.alsoIn.map((z) => z.name).join() === "middle,whole");
  const b = landing(zones, 500, 650);
  assert.ok(b.kind === "zone" && b.zone.name === "middle");
  assert.equal(landingWords(a), "In heart (also inside middle, whole)");
  const twin = [zone("one", { shape: "circle", cx: 300, cy: 300, r: 100 }), zone("two", { shape: "circle", cx: 300, cy: 300, r: 100 })];
  assert.ok((landing(twin, 300, 300) as { zone: Zone }).zone.name === "one", "the first listed wins a tie");
});

test("off the cloth and on the cloth in no zone are told apart", () => {
  const zones = [zone("ring", { shape: "ring", cx: 500, cy: 500, r: 300, ri: 200 })];
  assert.deepEqual(landing(zones, 500, 500), { kind: "none" });
  assert.deepEqual(landing(zones, -1, 500), { kind: "off" });
  assert.deepEqual(landing(zones, 500, 1001), { kind: "off" });
  assert.equal(landingWords({ kind: "off" }), "Off the cloth");
  assert.equal(landingWords({ kind: "none" }), "On the cloth, in no zone");
});

test("every shape has a default that passes the checks and can be described in words", () => {
  for (const s of ZONE_SHAPES) {
    const g = defaultGeom(s);
    assert.ok(cleanGeom(g).ok, s);
    assert.ok(describeGeom(g).length > 10, s);
    assert.ok(area(g) > 0, s);
  }
});

test("the checks refuse a zone that cannot be used, in plain words", () => {
  const bad = (g: unknown) => { const r = cleanGeom(g); assert.ok(!r.ok, JSON.stringify(g)); return (r as { error: string }).error; };
  bad({ shape: "circle", cx: 5000, cy: 0, r: 10 });
  bad({ shape: "circle", cx: 500, cy: 500, r: 0 });
  assert.match(bad({ shape: "ring", cx: 500, cy: 500, r: 100, ri: 100 }), /inner radius/);
  bad({ shape: "rectangle", x: 0, y: 0, w: 0, h: 10 });
  bad({ shape: "half", edge: "middle", at: 500 });
  bad({ shape: "half", edge: "left", at: 1000 });
  bad({ shape: "wedge", cx: 500, cy: 500, r: 100, start: 360, sweep: 90 });
  bad({ shape: "wedge", cx: 500, cy: 500, r: 100, start: 0, sweep: 360 });
  bad({ shape: "freehand", points: [[0, 0], [10, 10]] });
  assert.match(bad({ shape: "freehand", points: [[0, 0], [100, 100], [200, 200]] }), /straight line/);
  bad({ shape: "freehand", points: Array.from({ length: 25 }, (_, i) => [i * 10, (i * i) % 1000]) });
  bad({ shape: "blob" });
  bad(null);
  bad({ shape: "circle", cx: 1.5, cy: 0, r: 10 });
});

test("a zone needs a name; notes and colours are checked; the app supplies no meaning", () => {
  const g = defaultGeom("circle");
  assert.ok(!cleanZone({ name: "  ", geom: g }).ok);
  assert.ok(!cleanZone({ name: "x".repeat(61), geom: g }).ok);
  assert.ok(!cleanZone({ name: "a", color: "red", geom: g }).ok);
  assert.ok(!cleanZone({ name: "a", note: "n".repeat(301), geom: g }).ok);
  const ok = cleanZone({ name: "  The  ring ", note: " mine ", color: "#AABBCC", geom: g });
  assert.ok(ok.ok && ok.zone.name === "The ring" && ok.zone.note === "mine" && ok.zone.color === "#aabbcc");
  const src = readFileSync(path.join(__dirname, "..", "lib", "cloth-core.ts"), "utf8");
  assert.ok(!/meaning of|means that|represents/i.test(src.replace(/\/\/.*$/gm, "")), "no stock zone meanings in the code");
});

test("a cloth's zones must have different names, and there is a limit", () => {
  const z = (name: string) => ({ name, geom: defaultGeom("circle") });
  assert.match((cleanCloth({ name: "c", zones: [z("A"), z("a")] }) as { error: string }).error, /own name/);
  assert.ok(cleanCloth({ name: "c", zones: [z("A"), z("B")] }).ok);
  assert.ok(!cleanCloth({ name: "c", zones: Array.from({ length: MAX_ZONES + 1 }, (_, i) => z(`z${i}`)) }).ok);
  assert.ok(!cleanCloth({ name: "", zones: [] }).ok);
  assert.ok(cleanCloth({ name: "empty cloth", zones: [] }).ok, "a cloth with no zones is allowed");
  assert.ok(!cleanCloth({ name: "c", zones: "no" }).ok);
});

test("percents and units convert, and an app throw lands within a margin of the cloth", () => {
  assert.equal(toPercent(500), 50);
  assert.equal(toPercent(123), 12.3);
  assert.equal(fromPercent(12.3), 123);
  assert.equal(fromPercent(toPercent(777)), 777);
  for (const r of [0, 0.5, 0.999999]) {
    const p = randomPlace(() => r);
    assert.ok(p.x >= -THROW_MARGIN && p.x <= CLOTH_SIZE + THROW_MARGIN && p.y >= -THROW_MARGIN && p.y <= CLOTH_SIZE + THROW_MARGIN);
  }
  assert.deepEqual(randomPlace(() => 0), { x: -THROW_MARGIN, y: -THROW_MARGIN });
  let off = 0;
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) {
    const p = randomPlace(rng);
    if (landing([], p.x, p.y).kind === "off") off++;
  }
  assert.ok(off > 100 && off < 600, `about 17 percent land off the cloth with a 5 percent margin (${off} of 2000)`);
});

test("placements are checked against the items and the zones", () => {
  const zones = [zone("A", defaultGeom("circle"))];
  const good = { index: 0, where: "zone", zone: "A", x: 500, y: 500, facing: "down" };
  const ok = cleanPlacements([good, { index: 1, where: "off", zone: null, x: null, y: null, facing: "up" }], 3, zones, true);
  assert.ok(ok.ok && ok.list.length === 2 && ok.list[0].facing === "down" && ok.list[1].where === "off");
  assert.ok(cleanPlacements([good], 3, zones, false).ok && (cleanPlacements([good], 3, zones, false) as { list: { facing: unknown }[] }).list[0].facing === null, "no facing for dice");
  assert.ok(!cleanPlacements([{ ...good, zone: "B" }], 3, zones, true).ok, "a zone that is not on the cloth");
  assert.ok(!cleanPlacements([{ ...good, index: 3 }], 3, zones, true).ok, "an item that is not there");
  assert.ok(!cleanPlacements([good, good], 3, zones, true).ok, "the same item twice");
  assert.ok(!cleanPlacements([{ ...good, x: 5 }].map((p) => ({ ...p, y: null })), 3, zones, true).ok, "half a place");
  assert.ok(!cleanPlacements([{ ...good, where: "nowhere" }], 3, zones, true).ok);
  assert.ok(!cleanPlacements("x", 3, zones, true).ok);
  assert.ok(!cleanPlacements([good], 0, zones, true).ok);
  assert.ok(!cleanPlacements([good, { ...good, index: 1 }, { ...good, index: 2 }, { ...good, index: 3 }], 3, zones, true).ok, "more placements than items");
});

test("lib/cloth-core.ts imports nothing, so the browser can use it", () => {
  const src = readFileSync(path.join(__dirname, "..", "lib", "cloth-core.ts"), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), []);
});
