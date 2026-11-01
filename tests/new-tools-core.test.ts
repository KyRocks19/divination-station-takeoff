import test from "node:test";
import assert from "node:assert/strict";
import { PLAYING_CARDS, cardOfMeaningId, cleanDrawCount, drawCards, getCard } from "../lib/playingcards-data";
import { CLOTH_SIZE, castLandings, placeWords } from "../lib/charms-core";
import { cleanDay, cleanNoteBody, noteSummary } from "../lib/signs-core";
import { chanceOfAtLeast, chanceWords, cleanChoice, cleanOptions, pickTarget } from "../lib/remoteview-core";

// A random source that walks through fixed values, so a draw can be checked exactly.
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

test("the pack has 52 different cards with names and meaning ids that map back", () => {
  assert.equal(PLAYING_CARDS.length, 52);
  assert.equal(new Set(PLAYING_CARDS.map((c) => c.id)).size, 52);
  assert.equal(getCard("H-7")?.name, "Seven of Hearts");
  assert.equal(cardOfMeaningId("playing-S-A")?.name, "Ace of Spades");
  assert.equal(getCard("X-1"), null);
  assert.equal(cardOfMeaningId("hexagram-1"), null);
});

test("a draw gives different cards, and the whole pack when asked for more than exists", () => {
  const cards = drawCards(10, Math.random);
  assert.equal(new Set(cards.map((c) => c.id)).size, 10);
  assert.equal(drawCards(60, Math.random).length, 52);
  // The first pick is the card at the chosen place: 0 is the first card, a value just under 1 is the last.
  assert.equal(drawCards(1, seq(0))[0].id, "S-A");
  assert.equal(drawCards(1, seq(0.9999))[0].id, "C-K");
});

test("draw counts are whole numbers from 1 to 10", () => {
  assert.equal(cleanDrawCount(3), 3);
  assert.equal(cleanDrawCount("4"), 4);
  for (const bad of [0, 11, 1.5, "", "x", null, undefined]) assert.equal(cleanDrawCount(bad), null);
});

test("charm landings stay on the cloth and describe themselves in words", () => {
  for (const l of castLandings(200, Math.random)) {
    assert.ok(l.x >= 0 && l.x <= CLOTH_SIZE && l.y >= 0 && l.y <= CLOTH_SIZE);
    assert.ok(l.face === "up" || l.face === "down");
  }
  assert.equal(castLandings(5, Math.random).length, 5);
  assert.equal(placeWords(500, 500), "near the middle");
  assert.equal(placeWords(50, 50), "top, left");
  assert.equal(placeWords(950, 950), "bottom, right");
});

test("a note needs text, and a day must be a real date", () => {
  assert.equal(cleanNoteBody("  a crow at the window "), "a crow at the window");
  assert.equal(cleanNoteBody("   "), null);
  assert.equal(cleanNoteBody("x".repeat(5001)), null);
  assert.equal(cleanDay(""), null);
  assert.equal(cleanDay("2026-10-20"), "2026-10-20");
  assert.equal(cleanDay("2026-02-31"), undefined);
  assert.equal(cleanDay("yesterday"), undefined);
  assert.ok(noteSummary("dream", "x ".repeat(100)).length < 100);
});

test("blind-target options are four different non-empty targets", () => {
  assert.deepEqual(cleanOptions([" a ", "b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.equal(cleanOptions(["a", "A", "c", "d"]), null);
  assert.equal(cleanOptions(["a", "b", "c"]), null);
  assert.equal(cleanOptions(["a", "b", "c", ""]), null);
  assert.equal(cleanOptions(["a", "b", "c", "d".repeat(81)]), null);
  assert.equal(cleanChoice(3), 3);
  assert.equal(cleanChoice(4), null);
  assert.equal(cleanChoice("1"), null);
  for (const r of [0, 0.24, 0.25, 0.5, 0.99, 0.9999]) assert.ok([0, 1, 2, 3].includes(pickTarget(() => r)));
  assert.equal(pickTarget(() => 0.25), 1);
});

test("the chance of at least k right out of n by guessing is the exact binomial tail", () => {
  assert.equal(chanceOfAtLeast(0, 10), 1);
  assert.equal(chanceOfAtLeast(11, 10), 0);
  // One trial, one hit: one in four.
  assert.ok(Math.abs(chanceOfAtLeast(1, 1) - 0.25) < 1e-12);
  // Two trials, at least one hit: 1 - (3/4)^2.
  assert.ok(Math.abs(chanceOfAtLeast(1, 2) - (1 - 0.5625)) < 1e-12);
  // All ten of ten: (1/4)^10.
  assert.ok(Math.abs(chanceOfAtLeast(10, 10) - Math.pow(0.25, 10)) < 1e-15);
  // The tail never rises as the number of hits needed does.
  assert.ok(chanceOfAtLeast(5, 20) >= chanceOfAtLeast(6, 20));
  assert.equal(chanceWords(0.25), "about 1 in 4");
  assert.equal(chanceWords(0.0001), "under 1 in 1,000");
});
