import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatContext, type ContextInput } from "../lib/companion-context";

// What the AI companion is told about the person's own archetypes and concepts: only their words, labelled as theirs, and never the app's own archetype words.

const base: ContextInput = {
  noun: "rune",
  when: "2026-10-15",
  question: "What should I carry this week?",
  layoutName: null,
  items: [{ name: "Fehu", reversed: false, position: null, positionPrompt: null, origin: null, fields: [], meanings: [], earlierMeanings: [], earlier: [] }],
  entries: [],
};

test("an item linked to the person's own archetype or concept carries their name for it and what they wrote, labelled as theirs", () => {
  const input: ContextInput = {
    ...base,
    items: [{
      ...base.items[0],
      ownLinks: [
        { kind: "archetype", name: "My Hearth", side: "neutral", words: ["where I feel safe", "when it goes well: warm", "when it is hard: stuck"] },
        { kind: "concept", name: "The porch light", side: "shadow", words: ["left on for me"] },
        { kind: "archetype", name: "Quiet", side: "light", words: [] },
      ],
    }],
  };
  const text = formatContext(input).text;
  assert.match(text, /You linked it to your own archetype, "My Hearth"\nYou wrote about "My Hearth": where I feel safe; when it goes well: warm; when it is hard: stuck/);
  assert.match(text, /You linked it to your own concept, "The porch light", on the hard side\nYou wrote about "The porch light": left on for me/);
  assert.match(text, /You linked it to your own archetype, "Quiet", on the side that goes well(\n|$)/);
  assert.doesNotMatch(text, /You wrote about "Quiet"/);
});

test("nothing is added when an item has no links of the person's own", () => {
  assert.doesNotMatch(formatContext(base).text, /You linked it to/);
  assert.doesNotMatch(formatContext({ ...base, items: [{ ...base.items[0], ownLinks: [] }] }).text, /You linked it to/);
});

test("the person's own archetypes are read from their own rows only, and never the app's own archetype words", () => {
  const source = readFileSync(new URL("../lib/companion-own.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./db"]);
  // A link to a shared archetype is left out in the query itself, and every row is scoped to the person.
  assert.match(source, /l\.archetype_id IS NULL/);
  assert.match(source, /l\.user_id = \$1/);
  assert.match(source, /ua\.user_id = l\.user_id/);
  assert.match(source, /uc\.user_id = l\.user_id/);
  assert.doesNotMatch(source, /archetypes-data|common-meanings|sources/);
});

test("the builders import the own-links reader and no stock text: the pins in companion-context.test.ts name exactly what they import", () => {
  for (const f of ["companion-context.ts", "companion-context-tools.ts"]) {
    const source = readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8");
    assert.match(source, /from "\.\/companion-own"/, f);
    assert.doesNotMatch(source, /archetypes-data|symbol-links|symbol-archetype-map|archetype-reads|own-archetypes/, f);
  }
});
