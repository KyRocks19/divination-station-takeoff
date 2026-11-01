import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownThemesByMonth, pieceKey, tallyOwn, type DrawCount } from "../lib/own-tallies-core";
import type { OwnLink } from "../lib/own-archetypes";

const link = (id: number, piece: OwnLink["piece"], target: OwnLink["target"]): OwnLink => ({ id, piece, target, aspect: "neutral" });
const hearth = { kind: "user_archetype", id: 1, name: "My Hearth" } as const;
const porch = { kind: "user_concept", id: 2, name: "The porch light" } as const;
const courage = { kind: "archetype", slug: "courage-strength", name: "Courage and Strength" } as const;

const links: OwnLink[] = [
  link(1, { kind: "symbol", id: "rune-fehu" }, hearth),
  link(2, { kind: "symbol", id: "major-0" }, hearth),
  link(3, { kind: "symbol", id: "major-0" }, porch),
  link(4, { kind: "oracle_card", id: 9, name: "Tide" }, hearth),
  link(5, { kind: "symbol", id: "rune-fehu" }, courage),
];

test("a piece key is the shared id, or oracle:ID for the person's own item", () => {
  assert.equal(pieceKey({ kind: "symbol", id: "rune-fehu" }), "rune-fehu");
  assert.equal(pieceKey({ kind: "oracle_card", id: 9 }), "oracle:9");
});

test("each target counts the times its linked pieces came up, by tool, most often first", () => {
  const draws: DrawCount[] = [
    { tool: "runes", piece: "rune-fehu", n: 3 },
    { tool: "tarot", piece: "major-0", n: 2 },
    { tool: "oracle", piece: "oracle:9", n: 1 },
    { tool: "runes", piece: "rune-uruz", n: 5 }, // linked to nothing: ignored
  ];
  const t = tallyOwn(links, draws);
  assert.deepEqual(t.map((x) => [x.key, x.name, x.kind, x.total]), [
    ["a:1", "My Hearth", "your archetype", 6],
    ["s:courage-strength", "Courage and Strength", "shared archetype you linked", 3],
    ["c:2", "The porch light", "your concept", 2],
  ]);
  assert.deepEqual(t[0].byTool, { runes: 3, tarot: 2, oracle: 1 });
  assert.equal(t[1].slug, "courage-strength");
  assert.equal(t[0].slug, null);
});

test("a piece that never came up, or came up zero times, adds nothing", () => {
  assert.deepEqual(tallyOwn(links, []), []);
  assert.deepEqual(tallyOwn(links, [{ tool: "runes", piece: "rune-fehu", n: 0 }]), []);
  assert.deepEqual(tallyOwn([], [{ tool: "runes", piece: "rune-fehu", n: 4 }]), []);
});

test("ties are put in name order, so the list does not shuffle", () => {
  const t = tallyOwn(
    [link(1, { kind: "symbol", id: "rune-fehu" }, { kind: "user_archetype", id: 1, name: "Zebra" }), link(2, { kind: "symbol", id: "rune-fehu" }, { kind: "user_archetype", id: 2, name: "Apple" })],
    [{ tool: "runes", piece: "rune-fehu", n: 1 }]
  );
  assert.deepEqual(t.map((x) => x.name), ["Apple", "Zebra"]);
});

test("the counting core imports no database code, and the shared tallies do not import the person's own", () => {
  const importsOf = (f: string) => [...readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(importsOf("own-tallies-core.ts"), ["./divination-kinds", "./own-archetypes"]);
  assert.ok(!importsOf("archetype-tallies.ts").some((i) => /own-/.test(i)), "the shared counts must never include the person's own");
});

test("own themes by month: only their own archetypes and concepts, newest month first, never the shared ones they linked", () => {
  const draws: DrawCount[] = [
    { tool: "runes", piece: "rune-fehu", n: 2, month: "2026-09" },
    { tool: "runes", piece: "rune-fehu", n: 1, month: "2026-10" },
    { tool: "tarot", piece: "major-0", n: 4, month: "2026-10" },
    { tool: "oracle", piece: "oracle:9", n: 1, month: "2026-10" },
    { tool: "runes", piece: "rune-uruz", n: 9, month: "2026-10" }, // linked to nothing
    { tool: "runes", piece: "rune-fehu", n: 3 }, // no month: counted in the totals, not by month
  ];
  const months = ownThemesByMonth(links, draws);
  assert.deepEqual(months.map((m) => m.month), ["2026-10", "2026-09"]);
  assert.deepEqual(months[0].themes.map((t) => [t.name, t.kind, t.count]), [
    ["My Hearth", "your archetype", 6], // fehu 1 + major-0 4 + oracle 1
    ["The porch light", "your concept", 4],
  ]);
  assert.deepEqual(months[1].themes.map((t) => [t.name, t.count]), [["My Hearth", 2]]);
  // The shared archetype the person linked fehu to (courage) is the shared themes' business, not listed here.
  assert.ok(!JSON.stringify(months).includes("Courage and Strength"));
});

test("own themes by month: nothing linked or nothing drawn gives nothing, and the size is limited", () => {
  assert.deepEqual(ownThemesByMonth([], [{ tool: "runes", piece: "rune-fehu", n: 1, month: "2026-10" }]), []);
  assert.deepEqual(ownThemesByMonth(links, []), []);
  const many: DrawCount[] = Array.from({ length: 20 }, (_, i) => ({ tool: "runes" as const, piece: "rune-fehu", n: 1, month: `2025-${String((i % 12) + 1).padStart(2, "0")}` }));
  assert.ok(ownThemesByMonth(links, many).length <= 12);
});
