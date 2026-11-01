import { test } from "node:test";
import assert from "node:assert/strict";
import { CELTIC_CROSS_PLACES, STARTING_SPREADS } from "../lib/starter-layouts";

// A local copy has no preset rows in `spreads`, so these are the only layouts a new person there starts with, and the
// new reading page has no other way to draw.
test("the built-in starting spreads are usable layouts", () => {
  assert.equal(STARTING_SPREADS.length, 4);
  const names = STARTING_SPREADS.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, "names are unique (a same-named layout is skipped)");
  for (const spread of STARTING_SPREADS) {
    assert.ok(spread.positions.length > 0, `${spread.name} has positions`);
    for (const pos of spread.positions) assert.ok(pos.name.trim(), `${spread.name}: every position has a name, or Draw stays off`);
  }
});

test("the Celtic Cross keeps its board", () => {
  const cross = STARTING_SPREADS.find((s) => s.name === "Celtic Cross");
  assert.equal(cross?.positions.length, CELTIC_CROSS_PLACES.length);
});
