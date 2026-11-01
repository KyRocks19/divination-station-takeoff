import { test } from "node:test";
import assert from "node:assert/strict";
import { DIVINATION_KINDS, showEverythingCount, toolsLeftOut } from "../lib/divination-kinds";

test("the Show everything link shows no number unless something is left out", () => {
  assert.equal(showEverythingCount(undefined), "");
  assert.equal(showEverythingCount(0), "");
  assert.equal(showEverythingCount(-1), "");
});

test("the number names what it counts, in the singular for one", () => {
  assert.equal(showEverythingCount(5), " (5 more)");
  assert.equal(showEverythingCount(1, { one: "tool", many: "tools" }), " (1 more tool)");
  assert.equal(showEverythingCount(3, { one: "reading", many: "readings" }), " (3 more readings)");
});

test("tools left out: none for every tool, otherwise the rest", () => {
  assert.equal(toolsLeftOut(null), 0);
  assert.equal(toolsLeftOut([...DIVINATION_KINDS]), 0);
  assert.equal(toolsLeftOut(["tarot"]), DIVINATION_KINDS.length - 1);
  assert.equal(toolsLeftOut(["tarot", "runes"]), DIVINATION_KINDS.length - 2);
});
