import test from "node:test";
import assert from "node:assert/strict";
import { BLOT_SIZE, MAX_SEED, blotPaths, cleanSeed, isVessel, pickSeed } from "../lib/blots-core";
import { readFileSync } from "node:fs";
import { cleanToolReading } from "../lib/import-tools-core";
import { DIVINATION_KINDS, DIVINATION_KIND_LABELS, divinationPath } from "../lib/divination-kinds";

test("the same seed always draws the same shape, and different seeds differ", () => {
  for (const v of ["cup", "ink"] as const) {
    assert.deepEqual(blotPaths(12345, v), blotPaths(12345, v));
    assert.notDeepEqual(blotPaths(12345, v), blotPaths(54321, v));
    assert.ok(blotPaths(7, v).length >= 5);
  }
});

test("every path is built only from numbers and path letters, and stays near the picture", () => {
  for (let seed = 0; seed < 300; seed++) {
    for (const v of ["cup", "ink"] as const) {
      for (const d of blotPaths(seed * 7919, v)) {
        assert.match(d, /^[MQZ0-9. \-]+$/, `seed ${seed} ${v}`);
        const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
        assert.ok(nums.every((n) => Number.isFinite(n) && n > -40 && n < BLOT_SIZE + 40), `seed ${seed} ${v} within the picture`);
      }
    }
  }
});

test("a seed is a whole number from 0 up, and is picked from the person's random source", () => {
  assert.equal(cleanSeed(0), 0);
  assert.equal(cleanSeed(MAX_SEED), MAX_SEED);
  for (const bad of [-1, 1.5, MAX_SEED + 1, "5", null, undefined]) assert.equal(cleanSeed(bad), null);
  assert.equal(pickSeed(() => 0), 0);
  assert.ok(pickSeed(() => 0.9999999999) <= MAX_SEED);
  assert.ok(isVessel("cup") && isVessel("ink") && !isVessel("bowl"));
});

test("a shape imports from its kind and seed, and nothing else; a cup comes in as tasseomancy whichever tool the file names", () => {
  const base = { tool: "blots", created_at: "2026-10-20T10:00:00.000Z", summary: "An ink blot", journals: [], tags: [] };
  assert.deepEqual(cleanToolReading({ ...base, shape: { kind: "ink blot", seed: 99 } })?.detail, { kind: "blots", vessel: "ink", seed: 99, tea: null });
  // A cup keeps a known tea (migration 095); an unknown one, or a tea on an ink blot, is dropped.
  assert.deepEqual(cleanToolReading({ ...base, shape: { kind: "tea leaves in a cup", seed: 5, tea: "oolong" } })?.detail, { kind: "tea", vessel: "cup", seed: 5, tea: "oolong" });
  assert.deepEqual(cleanToolReading({ ...base, shape: { kind: "tea leaves in a cup", seed: 5, tea: "coffee" } })?.detail, { kind: "tea", vessel: "cup", seed: 5, tea: null });
  assert.deepEqual(cleanToolReading({ ...base, tool: "tea", shape: { kind: "tea leaves in a cup", seed: 5, tea: "green" } })?.detail, { kind: "tea", vessel: "cup", seed: 5, tea: "green" });
  assert.deepEqual(cleanToolReading({ ...base, tool: "tea", shape: { kind: "ink blot", seed: 5 } })?.detail, { kind: "blots", vessel: "ink", seed: 5, tea: null });
  assert.deepEqual(cleanToolReading({ ...base, shape: { kind: "ink blot", seed: 5, tea: "green" } })?.detail, { kind: "blots", vessel: "ink", seed: 5, tea: null });
  assert.equal(cleanToolReading({ ...base, shape: { kind: "tea leaves in a cup", seed: -1 } }), null);
  assert.equal(cleanToolReading({ ...base, shape: { kind: "tarot", seed: 1 } }), null);
});

test("tea leaves and ink blots are two tools, each with its own pages", () => {
  assert.ok(DIVINATION_KINDS.includes("tea") && DIVINATION_KINDS.includes("blots"));
  assert.equal(DIVINATION_KIND_LABELS.tea, "Tasseomancy");
  assert.equal(DIVINATION_KIND_LABELS.blots, "Inkblots");
  assert.equal(divinationPath("tea", 4), "/tea/4");
  assert.equal(divinationPath("blots", 4), "/blots/4");
  assert.match(readFileSync("app/api/tea/route.ts", "utf8"), /kind: "tea"/);
  assert.match(readFileSync("app/api/blots/route.ts", "utf8"), /kind: "blots"/);
  assert.doesNotMatch(readFileSync("components/blots/BlotForm.tsx", "utf8"), /TEAS|tea-core/);
});

test("the split moves each saved cup to tasseomancy and keeps a chosen tool list whole", () => {
  const sql = readFileSync("migrations/100_tea_split.sql", "utf8");
  assert.match(sql, /UPDATE divinations SET kind = 'tea'\s+WHERE kind = 'blots' AND id IN \(SELECT divination_id FROM blot_casts WHERE vessel = 'cup'\);/);
  assert.match(sql, /UPDATE users SET chosen_tools = chosen_tools \|\| ',tea'/);
  assert.doesNotMatch(sql, /DELETE|DROP/);
});
