// Checks on bringing an export back in (open item ED6): reading the file, checking every row, and the keys that tell what is already there. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  IMPORT_LIMITS, Tally, checkExport, cleanCardMeaning, cleanCards, cleanClarifiers, cleanConceptNote, cleanJournal, cleanLayout, cleanReading, cleanSynthesis, cleanTagRow,
  isoDate, journalKey, listOf, notImported, oneLine, parseExportFile, readingKey, skyToStore,
} from "../lib/import-core";

const card = (id: string, position = "Past", reversed = false) => ({ card_id: id, card_name: "ignored", position, reversed });
const goodReading = () => ({
  created_at: "2026-10-12T09:30:00.000Z",
  spread_name: "Three Card Spread",
  title: "About the move",
  question: "Should I go?",
  notes: "Felt calm.",
  sky: { recorded: true, moonPhase: "Full Moon", illumination: 99 },
  cards: [card("major-16", "Past"), card("cups-5", "Present", true)],
  clarifiers: { 1: [card("wands-2", "Clarifier")] },
  tags: ["move", "Move", "home"],
  journals: [{ created_at: "2026-10-12T10:00:00.000Z", author: "user", kind: "note", card_index: 0, clarifier_index: null, content: "First words." }],
});

test("a file that is not an export is refused in plain words", () => {
  assert.match((parseExportFile("") as { error: string }).error, /empty/);
  assert.match((parseExportFile("not json {") as { error: string }).error, /not a Divination Station export/);
  assert.match((parseExportFile("[1,2]") as { error: string }).error, /not a Divination Station export/);
  assert.match((parseExportFile('{"hello":1}') as { error: string }).error, /none of the parts/);
  assert.match((parseExportFile("x".repeat(IMPORT_LIMITS.bytes + 1)) as { error: string }).error, /too large/);
  assert.ok(parseExportFile('{"readings":[]}').ok);
  assert.ok(!checkExport(null).ok && !checkExport("text").ok);
});

test("lists are capped, and only objects are taken from them", () => {
  assert.equal(listOf([{ a: 1 }, 5, null, "x", [1], { b: 2 }]).length, 2);
  assert.equal(listOf("no").length, 0);
  assert.equal(listOf(Array.from({ length: 10 }, () => ({})), 3).length, 3);
});

test("dates must be believable, and text is cleaned without losing the person's own spacing", () => {
  assert.equal(isoDate("2026-10-12T09:30:00Z"), "2026-10-12T09:30:00.000Z");
  assert.equal(isoDate("1969-01-01"), null);
  assert.equal(isoDate("2999-01-01"), null);
  assert.equal(isoDate("garbage"), null);
  assert.equal(isoDate(5), null);
  assert.equal(oneLine("  a   b\n c "), "a b c");
  assert.equal(oneLine("   "), null);
});

test("cards must be in the deck; an unknown card refuses the whole reading, a clarifier is dropped", () => {
  assert.equal(cleanCards([card("major-16"), card("not-a-card")]), null);
  assert.equal(cleanCards([]), null);
  assert.equal(cleanCards("x"), null);
  const cards = cleanCards([card("major-16", "  Past  ", true)])!;
  assert.equal(cards[0].card_name, "The Tower", "the name comes from the deck, not from the file");
  assert.equal(cards[0].position, "Past");
  assert.equal(cards[0].reversed, true);
  const cl = cleanClarifiers({ 0: [card("wands-2"), card("nope")], 7: [card("wands-3")], x: [card("wands-3")], 1: "no" }, 2);
  assert.deepEqual(Object.keys(cl), ["0"], "a clarifier for a card that is not there, a bad key and a bad list are dropped");
  assert.equal(cl[0].length, 1);
});

test("a reading is checked, tidied and given a key", () => {
  const r = cleanReading(goodReading())!;
  assert.equal(r.spread_name, "Three Card Spread");
  assert.deepEqual(r.tags, ["move", "home"], "a tag that differs only by capitals is the same tag");
  assert.equal(r.journals.length, 1);
  assert.equal(r.cards.length, 2);
  assert.ok(r.sky && JSON.parse(r.sky).moonPhase === "Full Moon" && !("recorded" in JSON.parse(r.sky)));
  assert.equal(cleanReading({ ...goodReading(), created_at: "nonsense" }), null);
  assert.equal(cleanReading({ ...goodReading(), spread_name: "  " }), null);
  assert.equal(cleanReading({ ...goodReading(), cards: [card("zzz")] }), null);
  assert.equal(cleanReading(null), null);
  const long = cleanReading({ ...goodReading(), question: "q".repeat(5000), notes: "n".repeat(50_000) })!;
  assert.equal(long.question!.length, IMPORT_LIMITS.question);
  assert.equal(long.notes!.length, IMPORT_LIMITS.text);
});

test("a sky worked out from the date is not stored as if it had been recorded", () => {
  assert.equal(skyToStore({ recorded: false, moonPhase: "x" }), null);
  assert.equal(skyToStore(null), null);
  assert.ok(skyToStore({ recorded: true, moonPhase: "x" }));
});

test("the key of a reading ignores capitals in the spread, the milliseconds and the way the date is written", () => {
  const a = cleanReading(goodReading())!;
  const b = { ...a, spread_name: "three card SPREAD", created_at: "2026-10-12T09:30:00.999Z" };
  assert.equal(readingKey(a), readingKey(b));
  assert.equal(readingKey({ created_at: new Date("2026-10-12T09:30:00Z"), spread_name: a.spread_name, cards: a.cards }), readingKey(a), "a Date from the database gives the same key");
  assert.notEqual(readingKey(a), readingKey({ ...a, cards: [a.cards[0]] }));
  assert.notEqual(readingKey(a), readingKey({ ...a, created_at: "2026-10-12T09:30:01.000Z" }));
});

test("journal entries: author and kind fall back to plain ones, indexes must point at something, empty entries are dropped", () => {
  const j = cleanJournal({ created_at: "2026-10-12T10:00:00Z", author: "robot", kind: "weird", card_index: 9, clarifier_index: 3, card_id: "nope", content: "Words" }, 2)!;
  assert.deepEqual([j.author, j.kind, j.card_index, j.clarifier_index, j.card_id], ["user", "note", null, 3, null]);
  assert.equal(cleanJournal({ created_at: "2026-10-12T10:00:00Z", content: "   " }, 2), null);
  assert.equal(cleanJournal({ content: "no date" }, 2), null);
  assert.ok(journalKey({ created_at: "2026-10-12T10:00:00.5Z", author: "user", content: " Words " }) === journalKey({ created_at: "2026-10-12T10:00:00Z", author: "user", content: "Words" }));
});

test("card meanings: only tarot cards, in the export's own field names, with their earlier versions", () => {
  const m = cleanCardMeaning({
    card_id: "major-0", updated_at: "2026-10-01T00:00:00Z",
    current: { uprightKeywords: " leap ", reversedKeywords: null, uprightDescription: "My words", reversedDescription: "" },
    history: [{ saved_at: "2026-09-01T00:00:00Z", uprightKeywords: "jump" }, { saved_at: "bad", uprightKeywords: "x" }, { saved_at: "2026-09-02T00:00:00Z" }],
  })!;
  assert.equal(m.current!.upright_keywords, "leap");
  assert.equal(m.current!.reversed_description, null);
  assert.equal(m.history.length, 1, "a version with no date or no words is dropped");
  assert.equal(cleanCardMeaning({ card_id: "rune-fehu", current: { uprightKeywords: "x" } }), null);
  assert.equal(cleanCardMeaning({ card_id: "major-0", current: {}, history: [] }), null);
});

test("layouts, tags, notes and synthesis journals are checked", () => {
  const l = cleanLayout({ name: "  Where I am ", positions: [{ name: "Now", prompt: "Why?", color: "#ABCDEF", x: 10, y: 20.4, rotation: 90 }] })!;
  assert.deepEqual([l.name, l.positions[0].color, l.positions[0].y, l.positions[0].rotation], ["Where I am", "#abcdef", 20, 90]);
  assert.equal(cleanLayout({ name: "x", positions: [] }), null);
  assert.equal(cleanLayout({ name: "x", positions: [{ name: " " }] }), null);
  assert.equal(cleanLayout({ name: "x", positions: [{ name: "a", x: 99999 }] })!.positions[0].x, null, "a place off the board is dropped, not kept");
  const mixed = cleanLayout({ name: "m", positions: [{ name: "a", x: 1, y: 2, rotation: 90 }, { name: "b" }] })!;
  assert.deepEqual(mixed.positions.map((p) => [p.x, p.y, p.rotation]), [[null, null, null], [null, null, null]], "half a board comes in as a plain list, as the editor requires");
  const board = cleanLayout({ name: "b", positions: [{ name: "a", x: 1, y: 2 }, { name: "b", x: 3, y: 4, rotation: 45 }] })!;
  assert.deepEqual(board.positions.map((p) => [p.x, p.y, p.rotation]), [[1, 2, 0], [3, 4, 45]]);
  assert.deepEqual(cleanTagRow({ name: " Home ", color: "red" }), { name: "Home", color: "#7c3aed" });
  assert.equal(cleanTagRow({ name: "" }), null);
  assert.ok(cleanConceptNote({ concept: "Beginnings", content: "Mine", updated_at: "2026-01-01" }));
  assert.equal(cleanConceptNote({ concept: "Beginnings", content: " " }), null);
  assert.ok(cleanSynthesis({ prompt: "What links these?", content: "Words", created_at: "2026-01-01T00:00:00Z" }));
  assert.equal(cleanSynthesis({ prompt: "p", content: "c" }), null, "no date");
});

test("the report counts, and names the parts that are not brought in, leaving out empty ones", () => {
  const t = new Tally("x", "Things");
  t.added(2); t.had(); t.out(1, "why"); t.out(1, "another");
  assert.deepEqual(t.report, { id: "x", label: "Things", add: 2, have: 1, left_out: 2, note: "why" });
  const left = notImported({ readings: [], days: [{ a: 1 }], oracle_decks: [], account: {}, exported_at: "x", circle: {} }, ["readings"]);
  assert.deepEqual(left.map((n) => n.key).sort(), ["account", "circle", "days"]);
});

test("the import only adds: it has no UPDATE or DELETE of anything the person has", () => {
  const src = readFileSync(path.join(__dirname, "..", "lib", "import.ts"), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bDROP\b|ON CONFLICT/.test(src.replace(/`[^`]*`/g, (m) => (/INSERT INTO/.test(m) ? "" : m))), "no statement that changes or removes a row");
  for (const sql of src.match(/SELECT [^"`]*FROM [a-z_]+[^"`]*/g) ?? []) {
    // Shared reference data and the database's own column list hold nobody's writing (the second is read to know whether concepts.aliases exists yet).
    if (/FROM (concepts|generate_series|information_schema)/.test(sql)) continue;
    assert.ok(/user_id = \$1/.test(sql), `scoped to the person: ${sql.slice(0, 80)}`);
  }
  const route = readFileSync(path.join(__dirname, "..", "app", "api", "import", "route.ts"), "utf8");
  assert.ok(route.includes("if (!session.userId)") && route.includes("running.has(userId)"));
});
