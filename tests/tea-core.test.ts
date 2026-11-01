import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getArchetype } from "../lib/archetypes-data";
import { TEAS, TEA_KINDS, isTeaKind } from "../lib/tea-core";
import { TEA_CUP, blotPaths, blotSummary, teaLeaves } from "../lib/blots-core";

test("every tea has a label, words, colours and concepts that exist", () => {
  assert.equal(new Set(TEA_KINDS).size, TEAS.length);
  for (const t of TEAS) {
    assert.ok(t.label && t.examples && t.leaves && t.mindset, t.kind);
    for (const c of [t.liquor, t.leaf, t.leafLight]) assert.match(c, /^#[0-9a-f]{6}$/, `${t.kind} ${c}`);
    assert.ok(t.concepts.length >= 1 && t.concepts.length <= 4, t.kind);
    for (const slug of t.concepts) assert.ok(getArchetype(slug), `${t.kind}: ${slug} is not a shared archetype`);
  }
  assert.ok(isTeaKind("oolong") && !isTeaKind("coffee") && !isTeaKind(null) && !isTeaKind(3));
});

test("the same seed and tea always give the same leaves, and every piece is inside the bowl", () => {
  for (const tea of TEA_KINDS) {
    const a = teaLeaves(4242, tea);
    assert.deepEqual(a, teaLeaves(4242, tea));
    assert.notDeepEqual(a, teaLeaves(4243, tea));
    assert.ok(a.length > 20, tea);
    for (const p of a) {
      assert.match(p.d, /^M[-0-9. LQZ]+$/, `${tea}: a path is made of numbers only`);
      const nums = p.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i < nums.length; i += 2) {
        assert.ok(Math.hypot(nums[i] - TEA_CUP.cx, nums[i + 1] - TEA_CUP.cy) < TEA_CUP.bowl + 12, `${tea}: a piece is outside the cup`);
      }
    }
  }
});

test("a cup saved before teas could be chosen is drawn exactly as before", () => {
  // Pinned from the first piece of seed 7 before 2026-10-25, so older readings never change.
  assert.deepEqual(blotPaths(7, "cup").slice(0, 2), ["M150.3 119.6Q147.5 124.4 150.8 128.8Q153.6 124 150.3 119.6Z", "M154.8 125Q157.2 122 155.4 118.6Q153.1 121.6 154.8 125Z"]);
  assert.equal(blotSummary("cup"), "Tea leaves in a cup");
  assert.equal(blotSummary("cup", "green"), "Tea leaves in a cup (Green tea)");
  assert.equal(blotSummary("ink", "green"), "An ink blot");
});

test("the migration adds the tea column without changing what is there", () => {
  const sql = readFileSync("migrations/095_blot_tea.sql", "utf8");
  assert.match(sql, /ALTER TABLE blot_casts ADD COLUMN IF NOT EXISTS tea TEXT;/);
  assert.match(readFileSync("app/api/tea/route.ts", "utf8"), /INSERT INTO blot_casts \(user_id, divination_id, vessel, seed, tea\)/);
});
