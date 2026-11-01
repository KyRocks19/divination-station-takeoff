import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_THROW,
  MAX_THROW_ITEMS,
  cleanThrowItems,
  groupByObject,
  throwLine,
  throwSummary,
  throwSummaryOf,
} from "../lib/dice-data";

test("a throw can name several objects, each with its own count", () => {
  const r = cleanThrowItems({ items: [{ object: "d6", count: 2 }, { object: "coin", count: "1" }, { object: "d20" }] });
  assert.deepEqual(r, { items: [{ object: "d6", count: 2 }, { object: "coin", count: 1 }, { object: "d20", count: 1 }] });
});

test("the older single object and count still work", () => {
  assert.deepEqual(cleanThrowItems({ object: "d8", count: 3 }), { items: [{ object: "d8", count: 3 }] });
  assert.deepEqual(cleanThrowItems({ object: "coin" }), { items: [{ object: "coin", count: 1 }] });
});

test("anything not allowed gives a message, and no items", () => {
  const bad: unknown[] = [
    null,
    {},
    { object: "d7" },
    { object: "d6", count: 0 },
    { object: "d6", count: 1.5 },
    { object: "d6", count: MAX_THROW + 1 },
    { items: [] },
    { items: [{ object: "d6", count: 60 }, { object: "coin", count: 41 }] },
    { items: Array.from({ length: MAX_THROW_ITEMS + 1 }, () => ({ object: "coin", count: 1 })) },
    { items: [{ object: "d6", count: 1 }, "coin"] },
  ];
  for (const b of bad) {
    const r = cleanThrowItems(b);
    assert.ok("error" in r && typeof r.error === "string", JSON.stringify(b));
  }
});

test("the most allowed in all is exactly the limit", () => {
  assert.ok("items" in cleanThrowItems({ items: [{ object: "d6", count: 60 }, { object: "coin", count: 40 }] }));
  assert.ok("items" in cleanThrowItems({ items: Array.from({ length: MAX_THROW_ITEMS }, () => ({ object: "coin", count: 1 })) }));
});

test("results are gathered by object in the order each first came up", () => {
  const results = [
    { object: "d6", face: "3" },
    { object: "coin", face: "heads" },
    { object: "d6", face: "5" },
  ] as const;
  assert.deepEqual(groupByObject([...results]), [
    { object: "d6", faces: ["3", "5"] },
    { object: "coin", faces: ["heads"] },
  ]);
});

test("the shared record's summary is the old line for one object and a joined line for several", () => {
  const one = [{ object: "d6", face: "3" }, { object: "d6", face: "5" }] as const;
  assert.equal(throwSummaryOf([...one]), throwSummary("d6", ["3", "5"]));
  assert.equal(throwSummaryOf([...one]), "d6: 3, 5 (total 8)");
  const mixed = [...one, { object: "coin", face: "tails" }] as const;
  assert.equal(throwSummaryOf([...mixed]), "d6: 3, 5 (total 8); Coin: Tails");
});

test("a list line names each object and cuts a long throw off with how many more", () => {
  const mixed = [
    { object: "d6", face: "3" },
    { object: "coin", face: "heads" },
    { object: "d6", face: "5" },
  ] as const;
  assert.equal(throwLine([...mixed]), "Six-sided die (d6): 3, 5 · Coin: heads");
  const many = Array.from({ length: 20 }, (_, i) => ({ object: "d6" as const, face: String((i % 6) + 1) }));
  assert.equal(throwLine(many, 12), "Six-sided die (d6): 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, and 8 more");
  const spill = [...many.slice(0, 5), ...Array.from({ length: 5 }, () => ({ object: "coin" as const, face: "heads" }))];
  assert.equal(throwLine(spill, 7), "Six-sided die (d6): 1, 2, 3, 4, 5 · Coin: heads, heads, and 3 more");
});

// ── The knucklebone: four named sides, no numbers, no shared meanings ───────────────────────────
import { DICE_OBJECTS, faceId, faceLabel, facesOf, getFace, getObject, isNumbered, totalOf } from "../lib/dice-data";
import { stockPieces } from "../lib/symbol-edit-core";
import { isKnownSymbolId } from "../lib/symbol-ids";

test("a knucklebone has four sides named A to D, not numbers", () => {
  assert.deepEqual(facesOf("knucklebone"), ["a", "b", "c", "d"]);
  assert.equal(getObject("knucklebone")?.faces, 4);
  assert.deepEqual(facesOf("knucklebone").map(faceLabel), ["Side A", "Side B", "Side C", "Side D"]);
  assert.equal(faceId("knucklebone", "c"), "die-knucklebone-c");
});

test("a knucklebone side's id reads back, and only the four sides are real", () => {
  for (const f of facesOf("knucklebone")) {
    assert.deepEqual(getFace(faceId("knucklebone", f)), {
      id: `die-knucklebone-${f}`,
      name: `Knucklebone · Side ${f.toUpperCase()}`,
      object: "knucklebone",
      face: f,
    });
  }
  for (const bad of ["die-knucklebone-e", "die-knucklebone-1", "die-knucklebone-", "die-knucklebone-ab"]) {
    assert.equal(getFace(bad), undefined, bad);
  }
});

test("a knucklebone adds nothing up and its summary names the sides", () => {
  assert.equal(totalOf("knucklebone", ["a", "c"]), null);
  assert.equal(throwSummaryOf([{ object: "knucklebone", face: "a" }, { object: "knucklebone", face: "c" }]), "Knucklebone: Side A, Side C");
});

test("only numbered dice get number meanings and shared archetype links", () => {
  assert.equal(isNumbered("d6"), true);
  assert.equal(isNumbered("d100"), true);
  assert.equal(isNumbered("coin"), false);
  assert.equal(isNumbered("knucklebone"), false);
  assert.equal(isNumbered("d7"), false);
  assert.equal(DICE_OBJECTS.filter((o) => o.plainSides).map((o) => o.id).join(), "knucklebone");
});

test("the admin editor of shared links does not list a knucklebone, but a person can link their own words to a side", () => {
  assert.ok(!stockPieces().some((p) => p.id.startsWith("die-knucklebone-")));
  assert.ok(isKnownSymbolId("die-knucklebone-a"));
});

test("a knucklebone can be thrown with other things", () => {
  const r = cleanThrowItems({ items: [{ object: "knucklebone", count: 4 }, { object: "d6", count: 1 }] });
  assert.ok("items" in r);
});
