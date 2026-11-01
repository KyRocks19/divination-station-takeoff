import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIMITS, MAX, atLimit, cleanArchetype, cleanConcept, cleanLink, cleanPiece, manyLines, oneLine,
} from "../lib/own-archetypes-core";
import { SYMBOL_ID_SHAPE, isKnownSymbolId, knownSymbolIds } from "../lib/symbol-ids";

test("text is kept as written apart from tidying; control characters go, and nothing is read as markup", () => {
  assert.equal(oneLine("  My   hearth \n now "), "My hearth now");
  assert.equal(oneLine("a\u0000b\u0007c"), "abc");
  assert.equal(oneLine(42), "");
  assert.equal(manyLines("one  \r\n\r\n\r\n\r\ntwo\u0000"), "one\n\ntwo");
  assert.equal(oneLine("<b>bold</b> & more"), "<b>bold</b> & more"); // kept as text; React shows it as text
});

test("an archetype needs a name, trims fields, and refuses what is too long", () => {
  assert.equal(cleanArchetype({}).ok, false);
  assert.equal(cleanArchetype({ name: "   " }).ok, false);
  const ok = cleanArchetype({ name: " My Hearth ", summary: "where I feel safe", light: "warm", shadow: "stuck", realm: "" });
  assert.deepEqual(ok, { ok: true, value: { name: "My Hearth", realm: null, summary: "where I feel safe", light: "warm", shadow: "stuck" } });
  assert.equal(cleanArchetype({ name: "x".repeat(MAX.name + 1) }).ok, false);
  assert.equal(cleanArchetype({ name: "x", summary: "y".repeat(MAX.summary + 1) }).ok, false);
  assert.equal(cleanArchetype({ name: "x", light: 5 }).ok, false);
  assert.equal((cleanArchetype({ name: "x", realm: "Home" }) as { value: { realm: string } }).value.realm, "Home");
});

test("a concept sits under a shared archetype or one of the person's own, never both", () => {
  assert.equal(cleanConcept({ name: "Grandma's kitchen", shared_archetype: "family-home" }).ok, true);
  assert.equal(cleanConcept({ name: "x", user_archetype_id: 3 }).ok, true);
  assert.equal(cleanConcept({ name: "x" }).ok, true);
  assert.equal(cleanConcept({ name: "x", shared_archetype: "family-home", user_archetype_id: 3 }).ok, false);
  assert.equal(cleanConcept({ name: "x", user_archetype_id: -1 }).ok, false);
  assert.equal(cleanConcept({ name: "x", user_archetype_id: "3" }).ok, false);
  assert.equal(cleanConcept({ name: "x", shared_archetype: "Not A Slug!" }).ok, false);
  assert.equal(cleanConcept({ name: "x", description: "d".repeat(MAX.description + 1) }).ok, false);
});

test("known piece ids: tarot, runes, ogham, dice and coin faces, swings, scrying; nothing made up", () => {
  for (const id of ["major-0", "cups-ace", "rune-fehu", "ogham-oir", "die-d6-3", "die-d100-100", "coin-heads", "swing-circle_cw", "swing-line-45", "scrying-ball"]) {
    assert.equal(isKnownSymbolId(id), true, id);
  }
  for (const id of ["rune-nope", "die-d6-7", "die-d7-1", "swing-line-180", "swing-line-045", "scrying-tea", "../etc", "", "oracle-5"]) {
    assert.equal(isKnownSymbolId(id), false, id);
  }
});

test("a piece is one shared piece or one of the person's own oracle items", () => {
  assert.deepEqual(cleanPiece({ symbol_id: "rune-fehu" }), { ok: true, value: { kind: "symbol", id: "rune-fehu" } });
  assert.deepEqual(cleanPiece({ oracle_card_id: 12 }), { ok: true, value: { kind: "oracle_card", id: 12 } });
  assert.deepEqual(cleanPiece({ oracle_card_id: "12" }), { ok: true, value: { kind: "oracle_card", id: 12 } });
  assert.equal(cleanPiece({}).ok, false);
  assert.equal(cleanPiece({ symbol_id: "rune-fehu", oracle_card_id: 1 }).ok, false);
  assert.equal(cleanPiece({ symbol_id: "rune-nope" }).ok, false);
  assert.equal(cleanPiece({ oracle_card_id: 0 }).ok, false);
  assert.equal(cleanPiece({ oracle_card_id: 1.5 }).ok, false);
});

test("a link names one piece, one target and a side", () => {
  const link = (extra: Record<string, unknown>) => cleanLink({ symbol_id: "rune-fehu", ...extra });
  assert.deepEqual(link({ archetype: "wealth-prosperity" }), {
    ok: true, value: { piece: { kind: "symbol", id: "rune-fehu" }, target: { kind: "archetype", slug: "wealth-prosperity" }, aspect: "neutral" },
  });
  assert.equal((link({ user_archetype_id: 4, aspect: "shadow" }) as { value: { aspect: string } }).value.aspect, "shadow");
  assert.equal((link({ user_concept_id: 9 }) as { value: { target: { kind: string } } }).value.target.kind, "user_concept");
  assert.equal(link({}).ok, false);
  assert.equal(link({ archetype: "a-b", user_concept_id: 9 }).ok, false);
  assert.equal(link({ user_archetype_id: 0 }).ok, false);
  assert.equal(link({ archetype: "x", aspect: "both" }).ok, false);
  assert.equal(cleanLink(null).ok, false);
});

test("limits: 100 archetypes, 300 concepts, 1000 links", () => {
  assert.deepEqual({ ...LIMITS }, { archetypes: 100, concepts: 300, links: 1000 });
  assert.equal(atLimit(99, LIMITS.archetypes), false);
  assert.equal(atLimit(100, LIMITS.archetypes), true);
});

test("the core files import no database code", () => {
  const importsOf = (f: string) => [...readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(importsOf("own-archetypes-core.ts"), ["./own-limits", "./own-limits", "./symbol-ids"]);
  assert.deepEqual(importsOf("own-limits.ts"), []);
  assert.ok(!importsOf("symbol-ids.ts").some((i) => /db|session|auth/.test(i)));
});

test("every built-in piece id passes the id shape the routes check first (the pendulum swings once failed it)", () => {
  const ids = knownSymbolIds();
  assert.ok(ids.includes("swing-circle_cw"));
  for (const id of ids) assert.ok(SYMBOL_ID_SHAPE.test(id), id);
  for (const f of ["app/api/symbols/[id]/hidden/route.ts", "app/api/symbols/[id]/archetypes/route.ts"]) {
    assert.match(readFileSync(f, "utf8"), /SYMBOL_ID_SHAPE as ID/, `${f} uses the shared shape`);
  }
});
