import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARCHETYPES } from "../lib/archetypes-data";
import { RUNES } from "../lib/runes-data";
import { STAVES } from "../lib/ogham-data";
import { COIN_MEANINGS, OGHAM_MEANINGS, PENDULUM_MEANINGS, RUNE_MEANINGS, SCRYING_MEANINGS, numberMeaning } from "../lib/common-meanings-data";
import { DICE_OBJECTS, faceId, facesOf, isNumbered } from "../lib/dice-data";
import { isKnownSymbolId } from "../lib/symbol-ids";
import { SOURCES } from "../lib/sources";
import { BASES, BASIS_KEYS, checkSymbolMap, parseSymbolArchetypeFile } from "../lib/symbol-archetype-map";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const known = new Set(ARCHETYPES.map((a) => a.slug));
const sourceIds = new Set(SOURCES.map((s) => s.id));

const runes = parseSymbolArchetypeFile(read("data/symbol-archetypes-runes.txt"));
const ogham = parseSymbolArchetypeFile(read("data/symbol-archetypes-ogham.txt"));
const dice = parseSymbolArchetypeFile(read("data/symbol-archetypes-dice.txt"));
const pendulum = parseSymbolArchetypeFile(read("data/symbol-archetypes-pendulum.txt"));
const scrying = parseSymbolArchetypeFile(read("data/symbol-archetypes-scrying.txt"));
const diceIds = [
  ...Object.keys(COIN_MEANINGS),
  ...DICE_OBJECTS.filter((o) => isNumbered(o.id)).flatMap((o) => facesOf(o.id).map((f) => faceId(o.id, f))),
];

test("the reader understands the format", () => {
  const m = parseSymbolArchetypeFile(
    ["# comment", "@basis poem = a-source, b-source", "@basis myth =", "x-1 | one=poem, two:shadow=modern, three:either=app | a note | with a bar", "x-2 | - | none on purpose"].join("\n")
  );
  assert.deepEqual(m.problems, []);
  assert.deepEqual(m.sources.poem, ["a-source", "b-source"]);
  assert.deepEqual(m.sources.myth, []);
  assert.deepEqual(m.entries[0].links.map((l) => [l.slug, l.aspect, l.basis, l.primary]), [
    ["one", "neutral", "poem", true],
    ["two", "shadow", "modern", false],
    ["three", "neutral", "app", false],
  ]);
  assert.equal(m.entries[0].note, "a note | with a bar");
  assert.deepEqual(m.entries[1].links, []);
});

test("the reader reports bad lines instead of skipping them", () => {
  const m = parseSymbolArchetypeFile("a | one=nonsense\nb | One=poem\nc\n@basis poem is wrong");
  assert.equal(m.problems.length, 4);
});

test("the checker names a missing piece, a stray piece, a bad slug, a repeat and a missing note", () => {
  const m = parseSymbolArchetypeFile("p1 | nope=poem | n\np1 | courage-strength=poem, courage-strength=name | n\np9 | - |\n@basis poem = no-such-source");
  const problems = checkSymbolMap(m, ["p1", "p2"], known, sourceIds).join("\n");
  assert.match(problems, /"nope" is not an archetype/);
  assert.match(problems, /p1: listed twice/);
  assert.match(problems, /"courage-strength" listed twice/);
  assert.match(problems, /p9: not a piece of this set/);
  assert.match(problems, /p9: no archetype and no note/);
  assert.match(problems, /p2: missing from the file/);
  assert.match(problems, /no-such-source/);
});

test("every basis has a plain-words explanation", () => {
  for (const key of BASIS_KEYS) assert.ok(BASES[key].length > 20, key);
});

test("the rune file covers all 24 runes, with real archetypes and real sources", () => {
  assert.deepEqual(checkSymbolMap(runes, RUNES.map((r) => r.id), known, sourceIds), []);
  assert.equal(runes.entries.length, 24);
});

test("the ogham file covers all 25 letters; the five forfeda have no archetype on purpose, the 20 others have some", () => {
  assert.deepEqual(checkSymbolMap(ogham, STAVES.map((s) => s.id), known, sourceIds), []);
  for (const e of ogham.entries) {
    const stave = STAVES.find((s) => s.id === e.id)!;
    if (stave.aicme === 0) {
      assert.equal(e.links.length, 0, `${e.id} is a later letter and should have no archetype`);
      assert.ok(e.note.length > 30, `${e.id} needs a note saying why`);
    } else {
      assert.ok(e.links.length >= 1, `${e.id} needs an archetype`);
    }
  }
});

test("no link that the app has today is lost", () => {
  const lost: string[] = [];
  for (const [map, meanings] of [[runes, RUNE_MEANINGS], [ogham, OGHAM_MEANINGS]] as const) {
    for (const e of map.entries) {
      const today = meanings[e.id]?.archetypes ?? [];
      const now = new Set(e.links.map((l) => l.slug));
      for (const slug of today) if (!now.has(slug)) lost.push(`${e.id}: ${slug}`);
    }
  }
  assert.deepEqual(lost, []);
});

test("every rune has at least one link drawn from the poems, the name, or a story: something older than modern practice", () => {
  const older = new Set(["poem", "name", "gloss", "myth", "folk"]);
  const without = runes.entries.filter((e) => !e.links.some((l) => older.has(l.basis))).map((e) => e.id);
  assert.deepEqual(without, []);
});

test("links that rest on nothing but this app's own reading are few, and the first link of a piece is never one of them", () => {
  const all = [...runes.entries, ...ogham.entries];
  const appLinks = all.flatMap((e) => e.links.filter((l) => l.basis === "app").map((l) => `${e.id}:${l.slug}`));
  assert.ok(appLinks.length <= 6, `too many app-only links: ${appLinks.join(", ")}`);
  assert.deepEqual(all.filter((e) => e.links[0]?.basis === "app").map((e) => e.id), []);
});

test("the reader imports only the archetype types", () => {
  const imports = [...read("lib/symbol-archetype-map.ts").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./archetypes-data"]);
});

test("the notes are read by people, so they carry no reviewer markers", () => {
  for (const e of [...runes.entries, ...ogham.entries]) {
    assert.doesNotMatch(e.note, /\bNEW\b|\bTODO\b|\bDRAFT\b/, `${e.id}'s note reads like a review comment`);
  }
});

// --- The 78 tarot cards (a draft for the user to review; not in the database yet) ---

import { TAROT_DECK } from "../lib/cards";

const tarot = parseSymbolArchetypeFile(read("data/symbol-archetypes-tarot.txt"));

test("the tarot file covers all 78 cards, with real archetypes", () => {
  assert.deepEqual(checkSymbolMap(tarot, TAROT_DECK.map((c) => c.id), known, sourceIds), []);
  assert.equal(tarot.entries.length, 78);
});

test("every card has one to three archetypes, all neutral, and none rests on this app's own reading alone", () => {
  for (const e of tarot.entries) {
    assert.ok(e.links.length >= 1 && e.links.length <= 3, `${e.id} has ${e.links.length} links`);
    assert.ok(e.links.every((l) => l.aspect === "neutral"), `${e.id} has a link that names a side`);
    assert.ok(e.links.every((l) => l.basis !== "app"), `${e.id} has a link with no source`);
    assert.ok(e.note.length > 30, `${e.id} needs a note`);
  }
});

test("a card's first link is never one that only the encyclopedia's concept counts support", () => {
  // The first link must come from what the card says (its keywords, number, suit or name), so the keywords lead and the concept counts check.
  const bad = tarot.entries.filter((e) => e.links[0].basis === "encyclopedia").map((e) => e.id);
  assert.deepEqual(bad, []);
});

test("number cards that rest on numerology are Aces here, and a basis is only used for what it can say", () => {
  const byBasis = (b: string) => tarot.entries.flatMap((e) => e.links.filter((l) => l.basis === b).map(() => e.id));
  for (const id of byBasis("numerology")) assert.match(id, /-ace$/, `${id} uses numerology but is not an Ace`);
  for (const id of byBasis("name")) assert.match(id, /^major-/, `${id} uses its name but is not a Major Arcana card`);
  assert.ok(byBasis("suit").every((id) => !id.startsWith("major-")), "a Major Arcana card has no suit");
});

test("the tarot notes have no reviewer markers either", () => {
  for (const e of tarot.entries) assert.doesNotMatch(e.note, /\bNEW\b|\bTODO\b|\bDRAFT\b/, e.id);
});

test("the dice file covers the coin and every face of every die, and each id is a piece the app knows", () => {
  assert.deepEqual(checkSymbolMap(dice, diceIds, known, sourceIds), []);
  assert.equal(dice.entries.length, 2 + 4 + 6 + 8 + 10 + 12 + 20 + 100);
  for (const e of dice.entries) assert.ok(isKnownSymbolId(e.id), e.id);
});

test("dice links are labelled as number readings and the coin's as the app's own; nothing claims an old source", () => {
  for (const e of dice.entries) {
    const expected = e.id.startsWith("coin-") ? "app" : "number";
    for (const l of e.links) assert.equal(l.basis, expected, `${e.id} ${l.slug}`);
  }
  for (const e of [...pendulum.entries, ...scrying.entries]) for (const l of e.links) assert.equal(l.basis, "app", e.id);
});

test("the pendulum file covers the five starting swings and the scrying file the three surfaces", () => {
  assert.deepEqual(checkSymbolMap(pendulum, Object.keys(PENDULUM_MEANINGS), known, sourceIds), []);
  assert.deepEqual(checkSymbolMap(scrying, Object.keys(SCRYING_MEANINGS), known, sourceIds), []);
  assert.equal(pendulum.entries.length, 5);
  assert.equal(scrying.entries.length, 3);
});

test("seeding the dice, coin, pendulum and scrying files loses and changes no link the app has in code", () => {
  const diff: string[] = [];
  const same = (id: string, fromFile: string[], fromCode: string[]) => {
    if (fromFile.join() !== fromCode.join()) diff.push(`${id}: file ${fromFile.join("+")} / code ${fromCode.join("+")}`);
  };
  for (const e of dice.entries) {
    const slugs = e.links.map((l) => l.slug);
    if (e.id.startsWith("coin-")) same(e.id, slugs, COIN_MEANINGS[e.id].archetypes);
    else {
      const m = /^die-d(\d+)-(\d+)$/.exec(e.id)!;
      same(e.id, slugs, numberMeaning(Number(m[2]), Number(m[1])).archetypes);
    }
  }
  for (const e of pendulum.entries) same(e.id, e.links.map((l) => l.slug), PENDULUM_MEANINGS[e.id].archetypes);
  for (const e of scrying.entries) same(e.id, e.links.map((l) => l.slug), SCRYING_MEANINGS[e.id].archetypes);
  assert.deepEqual(diff, []);
});

// --- The 64 hexagrams and 16 geomantic figures (drafts for the owner to review, BIB1; not in the database yet) ---

import { HEXAGRAMS } from "../lib/iching-data";
import { FIGURES } from "../lib/geomancy-data";
import { readFileSync as readSeedSets } from "node:fs";

const iching = parseSymbolArchetypeFile(read("data/symbol-archetypes-iching.txt"));
const geomancy = parseSymbolArchetypeFile(read("data/symbol-archetypes-geomancy.txt"));

test("the hexagram and figure drafts cover every piece once, with real archetypes and real sources", () => {
  assert.deepEqual(checkSymbolMap(iching, HEXAGRAMS.map((h) => h.id), known, sourceIds), []);
  assert.deepEqual(checkSymbolMap(geomancy, FIGURES.map((f) => f.id), known, sourceIds), []);
  assert.equal(iching.entries.length, 64);
  assert.equal(geomancy.entries.length, 16);
});

test("each hexagram and figure has one to three links, drawn only from its name or marked as the app's own, with a note", () => {
  for (const e of [...iching.entries, ...geomancy.entries]) {
    assert.ok(e.links.length >= 1 && e.links.length <= 3, `${e.id} has ${e.links.length} links`);
    assert.ok(e.links.every((l) => l.basis === "name" || l.basis === "app"), `${e.id}: only the name was read, so no other basis may be claimed`);
    assert.ok(e.note.length > 5, `${e.id} needs a note`);
    if (e.links.every((l) => l.basis === "app")) assert.match(e.note, /app.s own/, `${e.id}: a piece with only the app's own links says so in its note`);
  }
});

test("the hexagram and figure drafts are not seeded until the owner has reviewed them", () => {
  const seedSets = readSeedSets(new URL("../lib/symbol-seed-sets.ts", import.meta.url), "utf8");
  assert.doesNotMatch(seedSets, /symbol-archetypes-(iching|geomancy)/);
  for (const f of ["iching", "geomancy"]) assert.match(read(`data/symbol-archetypes-${f}.txt`), /DRAFT written 2026-10-29/);
});
