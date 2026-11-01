// Checks on the other tools' parts of the import (open item ED6, part 2). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cleanClothRow, cleanDay, cleanDeck, cleanGuessIn, cleanNameRow, cleanOwnArchetypeRow, cleanOwnConceptRow, cleanOwnMeaning, cleanPrediction, cleanStyleRow, cleanSwing, cleanToolReading,
  groupPlacements, splitExportAngle, swingKey, toolReadingKey,
} from "../lib/import-tools-core";
import { MAX_STYLE_LENGTH } from "../lib/art-maker";

const base = { created_at: "2026-10-12T09:30:00.000Z", title: "T", question: "Q?", summary: "S", layout: null, sky: { moonPhase: "Full" }, journals: [{ created_at: "2026-10-12T10:00:00Z", author: "user", kind: "lookback", content: "Words" }] };

test("runes, ogham staves and dice come in by name and are refused when one item is not in the set", () => {
  const runes = cleanToolReading({ ...base, tool: "runes", runes: [{ name: "Fehu", upside_down: true, position: "Now" }, { name: "uruz", upside_down: false, position: null }] })!;
  assert.equal(runes.detail.kind, "runes");
  assert.deepEqual((runes.detail as { items: { id: string; reversed: boolean }[] }).items.map((i) => [i.id, i.reversed]), [["rune-fehu", true], ["rune-uruz", false]]);
  assert.equal(runes.journals[0].kind, "lookback");
  assert.equal(cleanToolReading({ ...base, tool: "runes", runes: [{ name: "Fehu" }, { name: "Not a rune" }] }), null, "one unknown item refuses the reading");
  assert.equal(cleanToolReading({ ...base, tool: "runes", runes: [] }), null);
  assert.ok(cleanToolReading({ ...base, tool: "ogham", staves: [{ name: "Beith", position: null }] }));
  assert.equal(cleanToolReading({ ...base, tool: "ogham", staves: [{ name: "Nonsense" }] }), null);
  const dice = cleanToolReading({ ...base, tool: "dice", results: [{ object: "d6", face: "3", position: null }, { object: "knucklebone", face: "a" }, { object: "coin", face: "heads" }] })!;
  assert.equal((dice.detail as { items: unknown[] }).items.length, 3);
  assert.equal(cleanToolReading({ ...base, tool: "dice", results: [{ object: "d6", face: "7" }] }), null, "a face a die does not have");
  assert.equal(cleanToolReading({ ...base, tool: "dice", results: [{ object: "d7", face: "1" }] }), null);
});

test("an oracle pull needs its set's name and items; scrying needs a surface the app has; a pendulum answer a known shape", () => {
  assert.ok(cleanToolReading({ ...base, tool: "oracle", deck: "My deck", cards: [{ name: "Moon", upside_down: false, position: null }] }));
  assert.equal(cleanToolReading({ ...base, tool: "oracle", deck: "", cards: [{ name: "Moon" }] }), null);
  assert.equal(cleanToolReading({ ...base, tool: "oracle", deck: "D", cards: [] }), null);
  const s = cleanToolReading({ ...base, tool: "scrying", surface: "mirror", minutes_looked: 7 })!;
  assert.deepEqual(s.detail, { kind: "scrying", surface: "mirror", minutes: 7 });
  assert.equal(cleanToolReading({ ...base, tool: "scrying", surface: "tea leaves" }), null);
  const p = cleanToolReading({ ...base, tool: "pendulum", swing: { name: "Line at 45.5°", shape: "line", angle: 45.5, your_words_then: "yes", chosen_by: "motion", phone_movement: { shape: "line", angle: 40 } } })!;
  assert.deepEqual((p.detail as { swing: { angle: number | null; tenths: number; chosen_by: string; motion_angle: number | null } }).swing, { name: "Line at 45.5°", shape: "line", angle: 45, tenths: 5, meaning: "yes", chosen_by: "motion", motion_shape: "line", motion_angle: 40 });
  assert.equal(cleanToolReading({ ...base, tool: "pendulum", swing: { name: "x", shape: "zigzag", angle: 1 } }), null);
  assert.equal(cleanToolReading({ ...base, tool: "tarot", cards: [] }), null, "tarot has its own part");
  assert.equal(cleanToolReading({ ...base, created_at: "nonsense", tool: "scrying", surface: "mirror" }), null);
});

test("a reading of another tool is told apart by its tool, moment and summary", () => {
  assert.equal(toolReadingKey({ kind: "runes", created_at: "2026-10-12T09:30:00.900Z", summary: " Fehu, Uruz " }), toolReadingKey({ kind: "runes", created_at: new Date("2026-10-12T09:30:00Z"), summary: "fehu, uruz" }));
  assert.notEqual(toolReadingKey({ kind: "runes", created_at: "2026-10-12T09:30:00Z", summary: "a" }), toolReadingKey({ kind: "ogham", created_at: "2026-10-12T09:30:00Z", summary: "a" }));
});

test("swings: the export's single angle is split into degrees and tenths, and a line needs an angle", () => {
  assert.deepEqual(splitExportAngle(45.5), { angle: 45, tenths: 5 });
  assert.deepEqual(splitExportAngle(179.9), { angle: 179, tenths: 9 });
  assert.deepEqual(splitExportAngle(0), { angle: 0, tenths: 0 });
  assert.deepEqual(splitExportAngle(null), { angle: null, tenths: 0 });
  assert.equal(splitExportAngle(180), null);
  assert.equal(splitExportAngle(-1), null);
  const s = cleanSwing({ name: " Mine ", shape: "line", angle: 33.3, in_play: false, your_words: "words", earlier_wordings: [{ saved_at: "2026-01-01", content: "old" }, { saved_at: "bad", content: "x" }] })!;
  assert.deepEqual([s.angle, s.tenths, s.name, s.in_play, s.history.length], [33, 3, "Mine", false, 1]);
  assert.equal(cleanSwing({ shape: "line", angle: null }), null);
  assert.deepEqual(cleanSwing({ shape: "circle_cw", angle: null })!.angle, null);
  assert.equal(swingKey({ shape: "line", angle: 33, tenths: 3 }), "line|33|3");
});

test("own meanings are for runes, ogham and dice only, with real piece ids", () => {
  assert.ok(cleanOwnMeaning({ symbol: "rune-fehu", current: { keywords: "wealth", updated_at: "2026-01-01" }, earlier_versions: [] }));
  assert.ok(cleanOwnMeaning({ symbol: "die-d6-3", current: { description: "three" } }));
  assert.equal(cleanOwnMeaning({ symbol: "major-0", current: { keywords: "x" } }), null, "tarot meanings have their own part");
  assert.equal(cleanOwnMeaning({ symbol: "rune-nonsense", current: { keywords: "x" } }), null);
  assert.equal(cleanOwnMeaning({ symbol: "rune-fehu", current: {}, earlier_versions: [] }), null);
});

test("oracle sets: names, forms, items with fields and meanings; an item's picture is flagged here and brought in by importPictures", () => {
  const d = cleanDeck({
    name: " My stones ", made_of: "stones", description: "d", cards_can_land_upside_down: true, upside_down_chance: 30, picture_style_note: "ink",
    cards: [{ name: "Moon", where_it_comes_from: "a beach", resting: true, picture: { kind: "upload", image: "data:..." }, fields: [{ name: "Colour", value: "grey" }, { name: " ", value: "x" }], meanings: [{ label: "Mine", content: "Calm", for_upside_down_card: false, updated_at: "2026-02-01T00:00:00Z", earlier_versions: [{ saved_at: "2026-01-01T00:00:00Z", content: "Older" }] }] }, { name: " " }],
  })!;
  assert.deepEqual([d.name, d.form, d.reversals, d.reversal_chance, d.art_style, d.cards.length], ["My stones", "stones", true, 30, "ink", 1]);
  assert.deepEqual([d.cards[0].resting, d.cards[0].picture, d.cards[0].fields.length, d.cards[0].meanings[0].history.length], [true, true, 1, 1]);
  assert.equal(cleanDeck({ name: "x", made_of: "spaceships" }), null, "a form the app does not have");
  assert.equal(cleanDeck({ name: " " }), null);
  assert.equal(cleanDeck({ name: "d", upside_down_chance: 500 })!.reversal_chance, 50, "an impossible chance becomes the default");
});

test("predictions, days: what is kept, and what is left out", () => {
  const p = cleanPrediction({ tool: "runes", reading: "A reading", written_at: "2026-10-12T09:30:00Z", first_words: "It will", current_words: "", look_back_on: "2026-12-01", what_happened: "partly", in_your_words: "half", looked_back_at: "2026-12-02T00:00:00Z" })!;
  assert.deepEqual([p.current_words, p.look_back_on, p.outcome, p.resolved_at !== null], ["It will", "2026-12-01", "partly", true]);
  assert.equal(cleanPrediction({ tool: "runes", reading: "R", written_at: "2026-10-12", first_words: "x", what_happened: "maybe" })!.outcome, null, "an outcome the app does not have");
  assert.equal(cleanPrediction({ tool: "runes", reading: "R", written_at: "2026-10-12", first_words: " " }), null);
  const d = cleanDay({ day: "2026-10-10", writing: "My day", items: [{ kind: "reading", mode: "snapshot", title: "T", text: "kept", added_at: "2026-10-10T08:00:00Z" }, { kind: "reading", mode: "link", href: "/readings/9" }, { kind: "bogus", mode: "snapshot", text: "x" }] })!;
  assert.deepEqual([d.writing, d.snapshots.length, d.links_left_out], ["My day", 1, 1]);
  assert.equal(cleanDay({ day: "2026-13-45", writing: "x" }), null);
  assert.equal(cleanDay({ day: "1960-01-01", writing: "x" }), null);
  assert.equal(cleanDay({ day: "2026-10-10", writing: "", items: [] }), null);
});

test("first guesses: what is kept, and what is left out", () => {
  const g = cleanGuessIn({ tool: "runes", reading: "A draw", sealed_at: "2026-10-12T09:30:00Z", guess: " a door ", fit: 4, fit_note: " mostly ", fit_at: "2026-10-13T00:00:00Z" })!;
  assert.deepEqual([g.guess, g.fit, g.fit_note, g.fit_at !== null], ["a door", 4, "mostly", true]);
  const noFit = cleanGuessIn({ tool: "runes", reading: "R", sealed_at: "2026-10-12", guess: "x", fit: 9, fit_note: "stray" })!;
  assert.deepEqual([noFit.fit, noFit.fit_note, noFit.fit_at], [null, null, null], "an answer the app does not have, and a note without one");
  assert.equal(cleanGuessIn({ tool: "runes", reading: "R", sealed_at: "2026-10-12", guess: "  " }), null);
  assert.equal(cleanGuessIn({ tool: "runes", reading: "R", guess: "x" }), null, "no sealed date");
});

test("own archetypes, names, styles, cloths and placements", () => {
  assert.equal(cleanOwnArchetypeRow({ name: "Mine", group: "Home", summary: "s", good_side: "l", hard_side: "h", made_at: "2026-01-01" })!.realm, "Home");
  assert.equal(cleanOwnArchetypeRow({ name: " " }), null);
  assert.deepEqual(cleanOwnConceptRow({ name: "C", description: "d", sits_under: { kind: "shared archetype", name: "New beginnings" } })!.under, { kind: "shared archetype", name: "New beginnings" });
  assert.equal(cleanOwnConceptRow({ name: "C", description: "d", sits_under: { kind: "other", name: "x" } })!.under, null);
  assert.deepEqual(cleanNameRow({ piece_id: "die-knucklebone-a", name: " the dog " }), { piece_id: "die-knucklebone-a", name: "the dog" });
  assert.equal(cleanNameRow({ piece_id: "die-d6-3", name: "x" }), null, "only the sides of a knucklebone can be named");
  assert.equal(cleanStyleRow({ name: "S", text: "x".repeat(MAX_STYLE_LENGTH + 1) }), null);
  assert.ok(cleanStyleRow({ name: "S", text: "ink" }));
  const c = cleanClothRow({ name: "Cloth", description: "d", zones: [{ name: "In", note: "n", color: "#AABBCC", shape: "circle", geometry: { shape: "circle", cx: 500, cy: 500, r: 100 } }] })!;
  assert.deepEqual([c.zones.length, c.zones[0].color], [1, "#aabbcc"]);
  assert.equal(cleanClothRow({ name: "Cloth", zones: [{ name: "Bad", geometry: { shape: "circle", cx: 5000, cy: 0, r: 1 } }] }), null, "a zone off the cloth refuses the cloth");
  const g = groupPlacements([
    { reading: { tool: "runes", made_at: "2026-10-12T09:30:00.4Z" }, cloth: "C", item: "Fehu", where: "in Inner", facing: "face up", thrown_by_the_app: false },
    { reading: { tool: "runes", made_at: "2026-10-12T09:30:00.9Z" }, cloth: "C", item: "Uruz", where: "off the cloth", facing: null, thrown_by_the_app: true },
    { reading: { tool: "runes", made_at: "2026-10-12T09:30:00Z" }, cloth: "C", item: "Bad", where: "somewhere else" },
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].rows.map((r) => [r.item, r.where_kind, r.zone, r.facing, r.simulated]), [["Fehu", "zone", "Inner", "up", false], ["Uruz", "off", null, null, true]]);
});

test("part 2 of the import has no statement that changes or removes what the person has, and every read is for the person", () => {
  const root = path.join(__dirname, "..");
  const src = readFileSync(path.join(root, "lib", "import-tools.ts"), "utf8").replace(/\/\/.*$/gm, "");
  const writes = [...src.matchAll(/`([^`]*)`|"((?:SELECT|INSERT|UPDATE|DELETE)[^"]*)"/g)].map((m) => m[1] ?? m[2]);
  for (const sql of writes) {
    if (/^\s*(UPDATE|DELETE|TRUNCATE|DROP)\b/i.test(sql)) assert.fail(`changes or removes rows: ${sql.slice(0, 60)}`);
    if (/^\s*SELECT\b/i.test(sql) && /FROM (?!generate_series|information_schema|archetypes\b|concepts\b)/.test(sql) && !/user_id = \$1|WHERE c\.user_id = \$1/.test(sql)) assert.fail(`read that is not scoped to the person: ${sql.slice(0, 80)}`);
  }
  assert.ok(!/ON CONFLICT/.test(src), "an existing row is never overwritten");
  const imp = readFileSync(path.join(root, "lib", "import.ts"), "utf8");
  for (const fn of ["importDecks", "importSwings", "importToolReadings", "importPredictions", "importDays", "importOwnArchetypes", "importNamesAndStyles", "importCloths", "importPictures"]) assert.ok(imp.includes(`await ${fn}(`) || imp.includes(`= await ${fn}(`), `${fn} is part of the import`);
});

test("pictures are brought in last, are checked like an upload, and a check writes no file", () => {
  const root = path.join(__dirname, "..");
  const imp = readFileSync(path.join(root, "lib", "import.ts"), "utf8");
  assert.ok(imp.indexOf("await importPictures(") > imp.indexOf("await importCloths("), "pictures come after every item exists");
  assert.ok(imp.indexOf("await importPictures(") < imp.indexOf("throw new RolledBack()"), "the check runs the same code before rolling back");
  assert.ok(/IMPORTED_KEYS = \[[^\]]*"art_gallery"/.test(imp), "the gallery counts as brought in");
  const core = readFileSync(path.join(root, "lib", "import-core.ts"), "utf8");
  assert.ok(!/art_gallery:\s*"/.test(core), "the gallery is no longer listed as not brought in");
  const src = readFileSync(path.join(root, "lib", "import-tools.ts"), "utf8");
  const pics = src.slice(src.indexOf("export async function importPictures"), src.indexOf("// ── Own names"));
  assert.ok(pics.includes("parseImageDataUrl(") && pics.includes("cleanDrawing("), "pictures and drawings are validated as a stranger's input");
  assert.ok(/apply \? placeBytes\(/.test(pics), "a file is written only when the import is applied");
  assert.ok(pics.includes("MAX_GALLERY_ITEMS") && pics.includes("room("), "the gallery limit and the picture space are kept");
});
