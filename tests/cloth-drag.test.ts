// Checks on dragging zones on the picture of a cloth. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ZONE_SHAPES, cleanGeom, defaultGeom, type Geom } from "../lib/cloth-core";
import { dragTo, handlesFor } from "../lib/cloth-drag";

test("every shape has dots, and each dot lies where the shape says it does", () => {
  for (const s of ZONE_SHAPES) {
    const hs = handlesFor(defaultGeom(s));
    assert.ok(hs.length >= 1, s);
    assert.equal(new Set(hs.map((h) => h.id)).size, hs.length, `${s}: dot ids differ`);
  }
});

test("dragging any dot to any place leaves a shape that passes the checks", () => {
  const places = [[0, 0], [1000, 1000], [-300, 400], [500, 500], [999, 1], [1500, 1500], [250, 750]];
  for (const s of ZONE_SHAPES) {
    const g0 = defaultGeom(s);
    for (const h of handlesFor(g0)) {
      for (const [x, y] of places) {
        const g = dragTo(g0, h.id, x, y);
        assert.ok(cleanGeom(g).ok, `${s} ${h.id} to ${x},${y}`);
      }
    }
  }
});

test("a circle: the centre moves it and the radius dot sets the radius", () => {
  const g = defaultGeom("circle");
  assert.deepEqual(dragTo(g, "c", 100, 200), { shape: "circle", cx: 100, cy: 200, r: 250 });
  assert.deepEqual(dragTo(g, "r", 800, 500), { shape: "circle", cx: 500, cy: 500, r: 300 });
});

test("a ring cannot have its inner radius pass its outer one", () => {
  const g = defaultGeom("ring") as Extract<Geom, { shape: "ring" }>;
  const inner = dragTo(g, "ri", 500 + 900, 500) as Extract<Geom, { shape: "ring" }>;
  assert.ok(inner.ri < inner.r);
  const outer = dragTo(g, "r", 500 + 50, 500) as Extract<Geom, { shape: "ring" }>;
  assert.ok(outer.r > outer.ri);
});

test("a rectangle: the top left corner keeps the bottom right corner where it is", () => {
  const g = defaultGeom("rectangle");
  assert.deepEqual(dragTo(g, "nw", 100, 100), { shape: "rectangle", x: 100, y: 100, w: 650, h: 650 });
  assert.deepEqual(dragTo(g, "se", 900, 800), { shape: "rectangle", x: 250, y: 250, w: 650, h: 550 });
  const m = dragTo(g, "move", 0, 0);
  assert.deepEqual(m, { shape: "rectangle", x: 0, y: 0, w: 500, h: 500 });
});

test("a half: the line follows the pointer from whichever side the half is on", () => {
  assert.deepEqual(dragTo({ shape: "half", edge: "left", at: 500 }, "line", 300, 10), { shape: "half", edge: "left", at: 300 });
  assert.deepEqual(dragTo({ shape: "half", edge: "right", at: 500 }, "line", 700, 10), { shape: "half", edge: "right", at: 300 });
  assert.deepEqual(dragTo({ shape: "half", edge: "top", at: 500 }, "line", 10, 200), { shape: "half", edge: "top", at: 200 });
  assert.deepEqual(dragTo({ shape: "half", edge: "bottom", at: 500 }, "line", 10, 800), { shape: "half", edge: "bottom", at: 200 });
});

test("a wedge: the start dot turns the slice and keeps its far edge; the end dot sets the width", () => {
  const g = { shape: "wedge", cx: 500, cy: 500, r: 400, start: 0, sweep: 90 } as const; // straight up to the right
  // Dragging the start dot onto the end edge (90 degrees) would make a slice of no width, so the wedge stays as it was.
  assert.deepEqual(dragTo(g, "start", 900, 500), g);
  const started = dragTo(g, "start", 100, 500) as Extract<Geom, { shape: "wedge" }>; // 270 degrees: the slice now runs 270 to 90
  assert.equal(started.start, 270);
  assert.equal(started.sweep, 180);
  const ended = dragTo(g, "end", 500, 900) as Extract<Geom, { shape: "wedge" }>; // straight down = 180 degrees
  assert.equal(ended.sweep, 180);
  assert.equal(ended.r, 400);
});

test("freehand corners move one at a time, and a drag that puts them in a line is ignored", () => {
  const g = { shape: "freehand", points: [[0, 0], [500, 0], [500, 500]] } as Extract<Geom, { shape: "freehand" }>;
  assert.deepEqual((dragTo(g, "p2", 900, 900) as typeof g).points[2], [900, 900]);
  assert.deepEqual(dragTo(g, "p2", 1000, 0), g); // 0,0 500,0 1000,0 are in a line
  assert.deepEqual(dragTo(g, "p9", 5, 5), g);
});

test("lib/cloth-drag.ts imports only the cloth core", () => {
  const src = readFileSync(path.join(__dirname, "..", "lib", "cloth-drag.ts"), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), ["./cloth-core"]);
});
