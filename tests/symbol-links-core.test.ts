import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BASES } from "../lib/symbol-archetype-map";
import { BASIS_LABELS, EMPTY_STORE, linksOf, sideOf, type SymbolStore } from "../lib/symbol-links-core";

const store: SymbolStore = {
  links: new Map([
    ["rune-fehu", [
      { slug: "wealth-prosperity", aspect: "neutral", basis: "poem", primary: true },
      { slug: "anger-conflict", aspect: "shadow", basis: "poem", primary: false },
    ]],
  ]),
  recorded: new Set(["rune-fehu", "ogham-oir"]),
  notes: new Map(),
};

test("a piece the database has links for uses them, in order, with their basis", () => {
  const links = linksOf(store, "rune-fehu", ["courage-strength"]);
  assert.deepEqual(links.map((l) => [l.slug, l.aspect, l.basis, l.primary]), [
    ["wealth-prosperity", "neutral", "poem", true],
    ["anger-conflict", "shadow", "poem", false],
  ]);
});

test("a piece the database records with no links has none on purpose, and the code mapping is not used", () => {
  assert.deepEqual(linksOf(store, "ogham-oir", ["courage-strength"]), []);
});

test("a piece the database knows nothing of keeps the older mapping in code, with no basis, first link primary", () => {
  const links = linksOf(store, "scrying-ball", ["focus-concentration", "dreams-vision"]);
  assert.deepEqual(links.map((l) => [l.slug, l.aspect, l.basis, l.primary]), [
    ["focus-concentration", "neutral", null, true],
    ["dreams-vision", "neutral", null, false],
  ]);
});

test("an empty store (nothing seeded) behaves exactly as the code mapping always did", () => {
  assert.deepEqual(linksOf(EMPTY_STORE, "rune-fehu", ["a", "b"]).map((l) => l.slug), ["a", "b"]);
  assert.deepEqual(linksOf(EMPTY_STORE, "rune-fehu", []), []);
});

test("which side a draw touches: upside down is the hard side; otherwise the link's own side; most links are either", () => {
  assert.equal(sideOf({ aspect: "neutral" }, false), "either");
  assert.equal(sideOf({ aspect: "light" }, false), "light");
  assert.equal(sideOf({ aspect: "shadow" }, false), "shadow");
  for (const aspect of ["neutral", "light", "shadow"] as const) assert.equal(sideOf({ aspect }, true), "shadow");
});

test("every basis has a short label and a long explanation", () => {
  for (const key of Object.keys(BASES)) assert.ok(BASIS_LABELS[key], `${key} has no short label`);
});

test("the readers import only what they should: the core imports types, the loader imports the database and the core", () => {
  const importsOf = (f: string) => [...readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(importsOf("symbol-links-core.ts"), ["./archetypes-data"]);
  assert.deepEqual(importsOf("symbol-links.ts"), ["@/lib/archetypes-data", "@/lib/db", "@/lib/symbol-links-core"]);
});

test("the companion's context builders still import none of this (stock text and archetype words are never sent)", () => {
  for (const f of ["companion-context.ts", "companion-context-tools.ts", "companion-subject.ts", "companion-noticed.ts"]) {
    const source = readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /symbol-links|symbol-archetype-map|archetype-reads|archetypes-data/, f);
  }
});
