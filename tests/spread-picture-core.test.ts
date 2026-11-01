// Checks on the plan of a spread picture: what it holds, where the cards go, and what it leaves out. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MAX_PICTURE_CARDS, PICTURE_DEFAULTS, boardPlaces, pictureFileName, planSpreadPicture, wrapWords, type PictureCard, type PictureReading } from "../lib/spread-picture-core";

const card = (position: string, card_name: string, extra: Partial<PictureCard> = {}): PictureCard => ({ position, card_name, reversed: false, file: "0-Fool.jpg", ...extra });
const reading = (cards: PictureCard[], extra: Partial<PictureReading> = {}): PictureReading => ({
  title: "Morning reading", spread_name: "Three card", question: "Should I move house?", created_at: "2026-10-20T09:00:00Z", cards, clarifiers: {}, ...extra,
});
const three = [card("Past", "The Fool"), card("Present", "The Magician", { reversed: true }), card("Future", "The Star")];

test("the question and the date are in the picture only when ticked", () => {
  const plain = planSpreadPicture(reading(three), PICTURE_DEFAULTS)!;
  assert.equal(plain.question.length, 0);
  assert.ok(!plain.description.includes("move house"));
  assert.ok(!plain.meta?.text.includes("2026"));
  const full = planSpreadPicture(reading(three), { question: true, date: true, art: true })!;
  assert.ok(full.question[0].text.startsWith("Question:"));
  assert.ok(full.description.includes("Should I move house?"));
  assert.ok(full.meta?.text.includes("2026"));
});

test("notes and journal text on the reading never reach the plan, even if the page hands over the whole reading", () => {
  // The page passes its whole reading object, which also holds the notes and the journal; only the named fields may be used.
  const whole = { ...reading(three), notes: "SECRET-NOTE", journals: [{ content: "SECRET-JOURNAL" }], sky: { moon: "SECRET-SKY" } } as unknown as PictureReading;
  const plan = planSpreadPicture(whole, { question: true, date: true, art: true })!;
  assert.doesNotMatch(JSON.stringify(plan), /SECRET/);
  assert.deepEqual(Object.keys(plan).sort(), ["cards", "description", "height", "meta", "question", "title", "width"]);
});

test("every card is in the picture with its position and its orientation", () => {
  const p = planSpreadPicture(reading(three), PICTURE_DEFAULTS)!;
  assert.equal(p.cards.length, 3);
  assert.deepEqual(p.cards.map((c) => c.name), ["The Fool", "The Magician", "The Star"]);
  assert.deepEqual(p.cards.map((c) => c.reversed), [false, true, false]);
  assert.deepEqual(p.cards.map((c) => c.label[0].text), ["PAST", "PRESENT", "FUTURE"]);
  assert.ok(p.description.includes("Present: The Magician (reversed)"));
  assert.ok(p.cards[1].below.some((l) => l.text === "reversed"));
});

test("without a board the cards go in rows of five and stay inside the picture", () => {
  const ten = Array.from({ length: 10 }, (_, i) => card(`Place ${i + 1}`, `Card ${i + 1}`));
  const p = planSpreadPicture(reading(ten), PICTURE_DEFAULTS)!;
  const rows = new Set(p.cards.map((c) => Math.round(c.y)));
  assert.equal(rows.size, 2);
  for (const c of p.cards) {
    assert.ok(c.x >= 0 && c.x + c.w <= p.width, `card ${c.index} inside the width`);
    assert.ok(c.y >= 0 && c.y + c.h <= p.height, `card ${c.index} inside the height`);
    for (const l of c.below) assert.ok(l.y < p.height, "words inside the height");
  }
});

test("a board layout keeps the places it gave, and a card lying across another shares its words", () => {
  const board = [
    card("The present", "Two of Cups", { x: 200, y: 200, rotation: 0 }),
    card("What crosses it", "Death", { x: 200, y: 200, rotation: 90 }),
    card("Below", "The Sun", { x: 200, y: 420, rotation: 0 }),
  ];
  assert.deepEqual(boardPlaces(board).map((b) => [b.x, b.y, b.rotation]), [[200, 200, 0], [200, 200, 90], [200, 420, 0]]);
  const p = planSpreadPicture(reading(board), PICTURE_DEFAULTS)!;
  const host = p.cards[0];
  const across = p.cards[1];
  assert.ok(across.label[0].y > host.below[host.below.length - 1].y, "the crossing card's words come under the first card's");
  assert.equal(across.rotation, 90);
  const lowest = Math.max(...p.cards.flatMap((c) => [...c.below.map((l) => l.y), c.y + c.h]));
  assert.ok(lowest < p.height);
});

test("clarifiers are listed under the card they clarify", () => {
  const p = planSpreadPicture(reading(three, { clarifiers: { 0: [{ card_name: "Ace of Cups", reversed: true }] } }), PICTURE_DEFAULTS)!;
  assert.ok(p.cards[0].below.some((l) => l.text.startsWith("clarifier: Ace of Cups")));
});

test("switching the art off leaves each card a plain box with its name", () => {
  const p = planSpreadPicture(reading(three), { ...PICTURE_DEFAULTS, art: false })!;
  assert.ok(p.cards.every((c) => c.file === null));
  assert.ok(p.cards.every((c) => c.below.some((l) => l.kind === "name")));
});

test("nothing is made for an empty spread or one too long to share", () => {
  assert.equal(planSpreadPicture(reading([]), PICTURE_DEFAULTS), null);
  const long = Array.from({ length: MAX_PICTURE_CARDS + 1 }, (_, i) => card(`P${i}`, `C${i}`));
  assert.equal(planSpreadPicture(reading(long), PICTURE_DEFAULTS), null);
});

test("a position colour is used only if it is a six-digit hex colour", () => {
  const p = planSpreadPicture(reading([card("A", "X", { color: "#FF00AA" }), card("B", "Y", { color: "red; background:url(x)" })]), PICTURE_DEFAULTS)!;
  assert.equal(p.cards[0].color, "#ff00aa");
  assert.equal(p.cards[1].color, "#a78bfa");
});

test("long words and long text are wrapped and cut with an ellipsis", () => {
  assert.deepEqual(wrapWords("one two three four five six", 9, 2), ["one two", "three…"]);
  assert.deepEqual(wrapWords("short", 10, 2), ["short"]);
  assert.equal(wrapWords("Supercalifragilisticexpialidocious", 10, 1)[0].length, 10);
  assert.deepEqual(wrapWords("   ", 10, 2), []);
});

test("the file name comes from the title", () => {
  assert.equal(pictureFileName("My Morning: Reading!", "Three card"), "my-morning-reading-spread.png");
  assert.equal(pictureFileName(null, "Celtic Cross"), "celtic-cross-spread.png");
  assert.equal(pictureFileName("???", ""), "reading-spread.png");
});

test("the plan file imports only the layout limits, and the painter only the plan", () => {
  const imports = (f: string) => [...readFileSync(path.join(__dirname, "..", "lib", f), "utf8").matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports("spread-picture-core.ts"), ["./layouts-shared"]);
  // The app's sigil is drawn on a card with no picture (2026-10-26); app-sigil-core is pure data.
  assert.deepEqual(imports("spread-picture-draw.ts"), ["./app-sigil-core", "./spread-picture-core"]);
});
