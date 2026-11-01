import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIVINATION_KINDS } from "../lib/divination-kinds";
import { GROUP_COLORS, SUMMARY_WORDS, byCount, ringLabel, toShares } from "../lib/tool-summary-core";

test("every tool has the words for its summary", () => {
  for (const kind of DIVINATION_KINDS) {
    const w = SUMMARY_WORDS[kind];
    assert.ok(w, kind);
    assert.ok(w.noun && w.unit && w.groupTitle, kind);
    assert.ok(ringLabel(kind).length > 10, kind);
  }
  assert.deepEqual(Object.keys(SUMMARY_WORDS).sort(), [...DIVINATION_KINDS].sort(), "no tool is missing and none is extra");
});

test("shares are the counts as percentages of their total, with empty groups left out", () => {
  const s = toShares([
    { id: "a", label: "A", count: 3 },
    { id: "b", label: "B", count: 0 },
    { id: "c", label: "C", count: 1 },
  ]);
  assert.deepEqual(s.map((x) => x.id), ["a", "c"]);
  assert.equal(s[0].percentage, 75);
  assert.equal(s[1].percentage, 25);
  assert.equal(s.reduce((n, x) => n + x.percentage, 0), 100);
  assert.deepEqual(toShares([]), []);
  assert.deepEqual(toShares([{ id: "a", label: "A", count: 0 }]), []);
});

test("a group keeps the colour it was given, and the others take the palette in turn", () => {
  const s = toShares([
    { id: "a", label: "A", count: 1, color: "#123456" },
    { id: "b", label: "B", count: 1 },
    { id: "c", label: "C", count: 1 },
  ]);
  assert.equal(s[0].color, "#123456");
  assert.equal(s[1].color, GROUP_COLORS[1]);
  assert.equal(s[2].color, GROUP_COLORS[2]);
  const many = toShares(Array.from({ length: GROUP_COLORS.length + 2 }, (_, i) => ({ id: String(i), label: String(i), count: 1 })));
  assert.equal(many[GROUP_COLORS.length].color, GROUP_COLORS[0], "the palette starts over");
});

test("the biggest group first, without changing the list it was given", () => {
  const rows = [{ count: 1 }, { count: 5 }, { count: 3 }];
  assert.deepEqual(byCount(rows).map((r) => r.count), [5, 3, 1]);
  assert.deepEqual(rows.map((r) => r.count), [1, 5, 3]);
});

test("the pure file imports only the list of tools", () => {
  const src = readFileSync(new URL("../lib/tool-summary-core.ts", import.meta.url), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), ["./divination-kinds"]);
});
