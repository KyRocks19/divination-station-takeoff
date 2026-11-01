import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownMarkdown, shapeOwnExport } from "../lib/export-own-core";
import type { OwnArchetype, OwnConcept, OwnLink } from "../lib/own-archetypes";

const archetype: OwnArchetype = {
  id: 1, name: "My Hearth", realm: "Home", summary: "where I feel safe", light: "warm", shadow: "stuck",
  created_at: "2026-10-15T10:00:00Z", updated_at: "2026-10-16T10:00:00Z", concepts: 1, links: 2,
};
const concepts: OwnConcept[] = [
  { id: 1, name: "The porch light", description: "left on for me", shared_archetype: null, user_archetype: { id: 1, name: "My Hearth" }, realm: "Hearth things", inherited_realm: "Home", links: 1, created_at: "2026-10-15T11:00:00Z", updated_at: "2026-10-15T11:00:00Z" },
  { id: 2, name: "Grandma's kitchen", description: "", shared_archetype: { slug: "family-home", name: "Family and Home" }, user_archetype: null, realm: null, inherited_realm: null, links: 0, created_at: "2026-10-15T12:00:00Z", updated_at: "2026-10-15T12:00:00Z" },
  { id: 3, name: "Loose idea", description: "", shared_archetype: null, user_archetype: null, realm: null, inherited_realm: null, links: 0, created_at: "2026-10-15T13:00:00Z", updated_at: "2026-10-15T13:00:00Z" },
];
const links: OwnLink[] = [
  { id: 1, piece: { kind: "symbol", id: "rune-fehu" }, target: { kind: "user_archetype", id: 1, name: "My Hearth" }, aspect: "neutral" },
  { id: 2, piece: { kind: "oracle_card", id: 9 }, target: { kind: "archetype", slug: "courage-strength", name: "Courage and Strength" }, aspect: "shadow" },
  { id: 3, piece: { kind: "oracle_card", id: 77 }, target: { kind: "user_concept", id: 1, name: "The porch light" }, aspect: "light" },
];

test("the export has the person's own words and names, in plain keys", () => {
  const data = shapeOwnExport([archetype], concepts, links, new Map([[9, "Tide"]]));
  assert.deepEqual(data.own_archetypes[0], {
    name: "My Hearth", group: "Home", summary: "where I feel safe", good_side: "warm", hard_side: "stuck",
    made_at: "2026-10-15T10:00:00Z", changed_at: "2026-10-16T10:00:00Z",
  });
  // Only the realm the person wrote is exported; a concept without one takes its archetype's again on import.
  assert.deepEqual(data.own_concepts.map((c) => c.realm), ["Hearth things", null, null]);
  assert.deepEqual(data.own_concepts.map((c) => c.sits_under), [
    { kind: "your archetype", name: "My Hearth" },
    { kind: "shared archetype", name: "Family and Home" },
    null,
  ]);
  assert.deepEqual(data.own_links.map((l) => [l.from.kind, l.from.id, l.to.kind, l.to.name, l.side]), [
    ["piece", "rune-fehu", "your archetype", "My Hearth", "either"],
    ["your oracle item", "Tide", "shared archetype", "Courage and Strength", "hard side"],
    ["your oracle item", "item 77", "your concept", "The porch light", "good side"],
  ]);
});

test("a link to a shared archetype carries its name only, never its words", () => {
  const data = shapeOwnExport([], [], links, new Map());
  assert.deepEqual(Object.keys(data.own_links[1].to).sort(), ["kind", "name"]);
});

test("the Markdown reads well and says nothing when there is nothing", () => {
  assert.deepEqual(ownMarkdown({ own_archetypes: [], own_concepts: [], own_links: [], own_names: [], cloths: [], cloth_placements: [] }), []);
  const text = ownMarkdown(shapeOwnExport([archetype], concepts, links, new Map([[9, "Tide"]]))).join("\n");
  assert.match(text, /### My Hearth \(Home\)/);
  assert.match(text, /\*\*When it is hard:\*\* stuck/);
  assert.match(text, /Concepts under it: The porch light/);
  assert.match(text, /Realm: Hearth things/);
  assert.match(text, /### Grandma's kitchen \(under Family and Home\)/);
  assert.match(text, /- Tide \(your oracle item\) → Courage and Strength \(shared archetype, hard side\)/);
  assert.match(text, /- rune-fehu → My Hearth \(your archetype\)/);
});

test("the export core imports no database code", () => {
  const imports = [...readFileSync(new URL("../lib/export-own-core.ts", import.meta.url), "utf8").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  // ./own-archetypes is types only; ./dice-data and ./ogham-data are pure (the browser imports them too) and name a knucklebone side
  // or an ogham stave in the export of own names (T17; staves added 2026-10-29).
  assert.deepEqual(imports, ["./own-archetypes", "./dice-data", "./ogham-data"]);
  assert.ok(!/from\s+"[^"]*\/(db|own-names)"/.test(readFileSync(new URL("../lib/dice-data.ts", import.meta.url), "utf8")), "dice-data touches no database code");
});

test("migration 060: every table of the person's own cascades with the account, targets cascade their links, and a concept survives its archetype", () => {
  const sql = readFileSync(new URL("../migrations/060_own_archetypes.sql", import.meta.url), "utf8");
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)];
  assert.deepEqual(tables.map((t) => t[1]), ["user_archetypes", "user_concepts", "user_symbol_links"]);
  for (const [, name, body] of tables) {
    assert.match(body, /user_id\s+INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/, `${name} must cascade with the account`);
  }
  const links = tables[2][2];
  for (const [col, ref] of [["oracle_card_id", "oracle_cards"], ["archetype_id", "archetypes"], ["user_archetype_id", "user_archetypes"], ["user_concept_id", "user_concepts"]]) {
    assert.match(links, new RegExp(String.raw`${col}\s+INTEGER REFERENCES ${ref}\(id\) ON DELETE CASCADE`), `${col} must cascade`);
  }
  const concepts = tables[1][2];
  assert.match(concepts, /shared_archetype_id INTEGER REFERENCES archetypes\(id\) ON DELETE SET NULL/);
  assert.match(concepts, /user_archetype_id\s+INTEGER REFERENCES user_archetypes\(id\) ON DELETE SET NULL/);
  assert.match(sql, /num_nonnulls\(symbol_id, oracle_card_id\) = 1/);
  assert.match(sql, /num_nonnulls\(archetype_id, user_archetype_id, user_concept_id\) = 1/);
});
