import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_MOTION_SAMPLES, lineGap, motionWords, nearestSwing, readMotion, type MotionPoint } from "../lib/pendulum-motion";
import { cleanAngle, formatAngle, lineSymbolId, splitAngle, swingName, swingWords, wordingChange } from "../lib/pendulum-swings";

// Made-up movement at 60 readings a second for six seconds, with a little noise that is the same every run.
const RATE = 60;
const SECONDS = 6;
const N = RATE * SECONDS;
const noise = (i: number) => 0.04 * Math.sin(i * 12.9898) + 0.03 * Math.cos(i * 78.233);

/** A back-and-forth push along a compass bearing (clockwise from straight up the screen), 2 swings a second. */
function line(bearingDegrees: number, strength = 2): MotionPoint[] {
  const b = (bearingDegrees * Math.PI) / 180;
  return Array.from({ length: N }, (_, i) => {
    const push = strength * Math.sin((2 * Math.PI * 2 * i) / RATE);
    return { x: push * Math.sin(b) + noise(i), y: push * Math.cos(b) + noise(i + 1000) };
  });
}

/** A push that turns round once every half second, clockwise or counter-clockwise as seen from above. */
function circle(clockwise: boolean, strength = 2): MotionPoint[] {
  return Array.from({ length: N }, (_, i) => {
    const phi = (2 * Math.PI * 2 * i) / RATE * (clockwise ? 1 : -1);
    // Clockwise from the top: up first, then right. The bearing form (sin phi, cos phi) turns clockwise as phi grows.
    return { x: strength * Math.sin(phi) + noise(i), y: strength * Math.cos(phi) + noise(i + 1000) };
  });
}

const still = (): MotionPoint[] => Array.from({ length: N }, (_, i) => ({ x: noise(i) * 2, y: noise(i + 1000) * 2 }));

test("a back-and-forth push is read as a line at its bearing", () => {
  for (const bearing of [0, 20, 45, 90, 135, 170]) {
    const r = readMotion(line(bearing));
    assert.equal(r?.shape, "line", `bearing ${bearing}`);
    assert.ok(r!.angle !== null && lineGap(r!.angle, bearing) < 4, `bearing ${bearing} was read as ${r?.angle}`);
  }
});

test("a line's two ends are the same line", () => {
  const a = readMotion(line(10));
  const b = readMotion(line(190));
  assert.ok(a?.angle !== null && b?.angle !== null && lineGap(a!.angle!, b!.angle!) < 4);
  assert.ok(a!.angle! >= 0 && a!.angle! < 180);
});

test("a push that turns round is read as a circle, in the way it turns", () => {
  assert.equal(readMotion(circle(true))?.shape, "circle_cw");
  assert.equal(readMotion(circle(false))?.shape, "circle_ccw");
  assert.equal(readMotion(circle(true))?.angle, null);
});

test("a hand at rest is read as still", () => {
  assert.equal(readMotion(still())?.shape, "still");
});

test("a steady push that never changes (a leaning hand, gravity) is not movement", () => {
  const leaning = Array.from({ length: N }, (_, i) => ({ x: 3 + noise(i), y: -2 + noise(i + 1000) }));
  assert.equal(readMotion(leaning)?.shape, "still");
});

test("too few readings, or readings that are not numbers, say nothing", () => {
  assert.equal(readMotion(line(30).slice(0, MIN_MOTION_SAMPLES - 1)), null);
  assert.equal(readMotion([]), null);
  assert.equal(readMotion(Array.from({ length: N }, () => ({ x: Number.NaN, y: 1 }))), null);
});

test("the nearest swing has the same shape, and for a line the nearest angle", () => {
  const swings = [
    { id: 1, shape: "line", angle: 0 },
    { id: 2, shape: "line", angle: 90 },
    { id: 3, shape: "line", angle: 45.5 },
    { id: 4, shape: "circle_cw", angle: null },
    { id: 5, shape: "still", angle: null },
  ];
  assert.equal(nearestSwing(swings, { shape: "line", angle: 40 })?.id, 3);
  assert.equal(nearestSwing(swings, { shape: "line", angle: 170 })?.id, 1);
  assert.equal(nearestSwing(swings, { shape: "line", angle: 80 })?.id, 2);
  assert.equal(nearestSwing(swings, { shape: "circle_cw", angle: null })?.id, 4);
  assert.equal(nearestSwing(swings, { shape: "still", angle: null })?.id, 5);
  // None in play goes that way: nothing is picked in its place.
  assert.equal(nearestSwing(swings, { shape: "circle_ccw", angle: null }), null);
  assert.equal(nearestSwing([], { shape: "line", angle: 10 }), null);
});

test("two swings at one angle are both candidates and the first one listed wins a tie", () => {
  const swings = [
    { id: 7, shape: "line", angle: 60 },
    { id: 8, shape: "line", angle: 60 },
  ];
  assert.equal(nearestSwing(swings, { shape: "line", angle: 61 })?.id, 7);
});

test("the gap between two lines wraps round at 180 degrees", () => {
  assert.equal(lineGap(5, 175), 10);
  assert.equal(lineGap(0, 90), 90);
  assert.equal(lineGap(30, 30), 0);
});

test("the words for a movement", () => {
  assert.equal(motionWords("line", 40), "a line at about 40°");
  assert.equal(motionWords("circle_cw", null), "a circle, clockwise");
  assert.equal(motionWords("still", null), "no movement");
});

test("angles are kept to a tenth of a degree", () => {
  assert.equal(cleanAngle(0), 0);
  assert.equal(cleanAngle(179), 179);
  assert.equal(cleanAngle(179.9), 179.9);
  assert.equal(cleanAngle(45.3), 45.3);
  assert.equal(cleanAngle(0.1 + 0.2), 0.3);
  for (const bad of [180, 179.95, -0.1, 1.25, Number.NaN, Number.POSITIVE_INFINITY, "45", null, undefined]) assert.equal(cleanAngle(bad), null, String(bad));
});

test("an angle splits into whole degrees and a tenth and back", () => {
  assert.deepEqual(splitAngle(45.3), { whole: 45, tenths: 3 });
  assert.deepEqual(splitAngle(0), { whole: 0, tenths: 0 });
  assert.deepEqual(splitAngle(179.9), { whole: 179, tenths: 9 });
  assert.deepEqual(splitAngle(90), { whole: 90, tenths: 0 });
  for (let t = 0; t < 1800; t += 7) {
    const a = t / 10;
    const { whole, tenths } = splitAngle(a);
    assert.equal(whole + tenths / 10, a);
  }
});

test("a line is named and described with its tenth only when it has one", () => {
  assert.equal(formatAngle(45), "45");
  assert.equal(formatAngle(45.3), "45.3");
  assert.equal(swingName({ shape: "line", angle: 45.3 }), "Line at 45.3°");
  assert.equal(swingName({ shape: "line", angle: 45 }), "Line at 45°");
  assert.equal(swingName({ shape: "line", angle: 0, builtin: 1 }), "Back and forth");
  assert.equal(swingName({ shape: "line", angle: 0, builtin: 0 }), "Line at 0°");
  assert.equal(swingName({ shape: "line", angle: 12.5, name: "North door" }), "North door");
  assert.match(swingWords({ shape: "line", angle: 45.3 }), /45\.3°/);
});

test("a line's links are kept by whole degree, so a tenth shares them with its degree", () => {
  assert.equal(lineSymbolId(45), "swing-line-45");
  assert.equal(lineSymbolId(45.3), "swing-line-45");
  assert.equal(lineSymbolId(179.9), "swing-line-179");
  assert.equal(lineSymbolId(0.9), "swing-line-0");
});

test("a change in the person's words is described by what happened, not by whether it is better", () => {
  assert.equal(wordingChange(null, null), null);
  assert.equal(wordingChange("yes", "  yes "), null);
  assert.equal(wordingChange("", "yes"), "added");
  assert.equal(wordingChange("yes", null), "cleared");
  assert.equal(wordingChange("yes", "maybe"), "changed");
});
