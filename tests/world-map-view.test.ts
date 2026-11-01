import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAP_HEIGHT, MAP_WIDTH } from "../lib/world-map-data";
import { MAX_ZOOM, WHOLE_GLOBE, clampView, panBy, pinchFactor, pixelsToMap, screenToMap, viewSize, zoomAt, zoomWords } from "../lib/world-map-view";

test("the map starts with the whole globe in view", () => {
  assert.deepEqual(WHOLE_GLOBE, { k: 1, x: 0, y: 0 });
  assert.deepEqual(viewSize(WHOLE_GLOBE), { w: MAP_WIDTH, h: MAP_HEIGHT });
  assert.equal(zoomWords(WHOLE_GLOBE), "The whole world is in view.");
});

test("a view is kept inside the map: zoom from 1 to the most, never past an edge, and nonsense becomes the whole globe", () => {
  assert.deepEqual(clampView({ k: 0.2, x: 50, y: 50 }), { k: 1, x: 0, y: 0 });
  const big = clampView({ k: 99, x: 5000, y: 5000 });
  assert.equal(big.k, MAX_ZOOM);
  assert.equal(big.x, MAP_WIDTH - MAP_WIDTH / MAX_ZOOM);
  assert.equal(big.y, MAP_HEIGHT - MAP_HEIGHT / MAX_ZOOM);
  assert.deepEqual(clampView({ k: NaN, x: NaN, y: NaN }), WHOLE_GLOBE);
  assert.deepEqual(clampView({ k: 2, x: -40, y: -40 }), { k: 2, x: 0, y: 0 });
});

test("zooming keeps the point under the pointer where it is", () => {
  const point: [number, number] = [300, 120];
  const v = zoomAt(WHOLE_GLOBE, 2, point[0], point[1]);
  assert.equal(v.k, 2);
  // On the screen the point sits at the same share of the width and height as before.
  const share = (view: typeof v) => [(point[0] - view.x) / viewSize(view).w, (point[1] - view.y) / viewSize(view).h];
  assert.deepEqual(share(v).map((n) => Math.round(n * 1e6) / 1e6), share(WHOLE_GLOBE).map((n) => Math.round(n * 1e6) / 1e6));
  // Zooming back out returns to the whole globe.
  assert.deepEqual(zoomAt(v, 0.5, point[0], point[1]), WHOLE_GLOBE);
  // The zoom cannot pass its limits.
  assert.equal(zoomAt(zoomAt(WHOLE_GLOBE, 100, 500, 200), 100, 500, 200).k, MAX_ZOOM);
  assert.equal(zoomAt(WHOLE_GLOBE, 0.01, 500, 200).k, 1);
});

test("zooming near an edge does not leave the map", () => {
  const v = zoomAt(WHOLE_GLOBE, 4, MAP_WIDTH, MAP_HEIGHT);
  assert.equal(v.x + viewSize(v).w, MAP_WIDTH);
  assert.equal(v.y + viewSize(v).h, MAP_HEIGHT);
  const corner = zoomAt(WHOLE_GLOBE, 4, 0, 0);
  assert.deepEqual({ x: corner.x, y: corner.y }, { x: 0, y: 0 });
});

test("panning moves the view and stops at the edges", () => {
  const zoomed = { k: 4, x: 100, y: 50 };
  assert.deepEqual(panBy(zoomed, 20, -10), { k: 4, x: 120, y: 40 });
  assert.equal(panBy(zoomed, -9999, -9999).x, 0);
  assert.equal(panBy(zoomed, 9999, 9999).x, MAP_WIDTH - MAP_WIDTH / 4);
  // At the whole globe there is nowhere to go.
  assert.deepEqual(panBy(WHOLE_GLOBE, 80, 80), WHOLE_GLOBE);
});

test("a place on the screen is turned into a point on the map, and a drag into the same distance", () => {
  const box = { left: 10, top: 20, width: 500, height: 200 };
  assert.deepEqual(screenToMap(WHOLE_GLOBE, 10, 20, box), [0, 0]);
  assert.deepEqual(screenToMap(WHOLE_GLOBE, 510, 220, box), [MAP_WIDTH, MAP_HEIGHT]);
  const v = { k: 2, x: 100, y: 40 };
  const [mx, my] = screenToMap(v, 260, 120, box);
  assert.equal(mx, 100 + MAP_WIDTH / 4);
  assert.equal(my, 40 + MAP_HEIGHT / 4);
  assert.equal(pixelsToMap({ k: 2, x: 0, y: 0 }, 50, 500), MAP_WIDTH / 2 / 10);
});

test("two fingers spreading zoom in, pinching zoom out, and two fingers on one spot change nothing", () => {
  const a = [{ x: 100, y: 100 }, { x: 200, y: 100 }];
  assert.equal(pinchFactor(a, [{ x: 50, y: 100 }, { x: 250, y: 100 }]), 2);
  assert.equal(pinchFactor(a, [{ x: 125, y: 100 }, { x: 175, y: 100 }]), 0.5);
  assert.equal(pinchFactor([{ x: 5, y: 5 }, { x: 5, y: 5 }], a), 1);
});

test("the pure file imports only the map's own data", () => {
  const src = readFileSync(new URL("../lib/world-map-view.ts", import.meta.url), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), ["./world-map-data"]);
});
