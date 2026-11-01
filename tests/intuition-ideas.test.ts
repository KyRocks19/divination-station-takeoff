import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanConfidence, confidenceVsFit, fitByTag, overallFit, MIN_FITS_FOR_AVERAGE, type Fit } from "../lib/guess-core";
import { DECK_SIZE, SUIT_SIZES, PRACTICE_SUITS, chanceOf, suitOfCard, summarize } from "../lib/tarot-practice-core";
import { cleanLookBackDay, lookBackDay, questionKey } from "../lib/reading-extras-core";
import { formatYearReview, isReviewYear } from "../lib/year-review-core";
import { examplePatterns } from "../lib/patterns-example";
import { cleanPracticeRow } from "../lib/import-tools-core";

// The nine intuition ideas of docs/release-plan.md §6 and the owner's decisions of 2026-10-22.

test("idea 1: how sure is 1 to 5 or left out, and is counted against fitting well", () => {
  assert.equal(cleanConfidence(3), 3);
  assert.equal(cleanConfidence(null), null);
  assert.equal(cleanConfidence(undefined), null);
  for (const bad of [0, 6, 2.5, "3"]) assert.equal(cleanConfidence(bad), undefined);
  const rows = [
    { confidence: 5 as const, fit: 5 as Fit }, { confidence: 5 as const, fit: 2 as Fit }, { confidence: 5 as const, fit: 4 as Fit },
    { confidence: 1 as const, fit: 1 as Fit }, { confidence: null, fit: 5 as Fit }, { confidence: 3 as const, fit: null },
  ];
  assert.deepEqual(confidenceVsFit(rows), [
    { confidence: 5, rated: 3, fittedWell: 2 },
    { confidence: 1, rated: 1, fittedWell: 0 },
  ]);
});

test("idea 3: fit by tag has an average only after enough answers, beside the person's own overall", () => {
  const rows = [
    ...Array.from({ length: MIN_FITS_FOR_AVERAGE }, () => ({ tag: "rested", fit: 4 as Fit })),
    { tag: "rushed", fit: 2 as Fit },
  ];
  assert.deepEqual(fitByTag(rows), [
    { tag: "rested", rated: MIN_FITS_FOR_AVERAGE, average: 4 },
    { tag: "rushed", rated: 1, average: null },
  ]);
  assert.equal(overallFit([1, 2]), null);
  assert.equal(overallFit([4, 4, 4, 2, 1]), 3);
});

test("idea 4: the chance figure follows the deck: 22 major arcana and 14 in each suit", () => {
  assert.equal(Object.values(SUIT_SIZES).reduce((a, b) => a + b, 0), DECK_SIZE);
  assert.equal(PRACTICE_SUITS.length, 5);
  assert.equal(suitOfCard("major-0"), "major");
  assert.equal(suitOfCard("cups-king"), "cups");
  assert.equal(suitOfCard("nonsense"), null);
  const s = summarize([
    { guess_suit: "major", card_id: "major-3" },
    { guess_suit: "cups", card_id: "swords-2" },
    { guess_suit: null, card_id: "wands-ace" },
  ]);
  assert.equal(s.trials, 2);
  assert.equal(s.hits, 1);
  assert.equal(s.expected, Math.round((chanceOf("major") + chanceOf("cups")) * 10) / 10);
});

test("idea 4: the sealed card never reaches the browser before the guess", () => {
  const route = readFileSync(new URL("../app/api/tarot-practice/route.ts", import.meta.url), "utf8");
  assert.match(route, /Response\.json\(\{ id: await sealedTrial/);
  const lib = readFileSync(new URL("../lib/tarot-practice.ts", import.meta.url), "utf8");
  assert.match(lib, /randomInt\(/, "a cryptographic random number chooses the card");
  assert.match(lib, /guessed_at IS NULL RETURNING card_id/, "a card is shown only by saving a guess on an unguessed one");
  const page = readFileSync(new URL("../components/TarotPractice.tsx", import.meta.url), "utf8");
  assert.ok(!/@\/lib\/cards"/.test(page), "the practice page must not import the deck");
});

test("idea 4: a practice row in an import must name a real card and suit", () => {
  assert.ok(cleanPracticeRow({ card: "pentacles-queen", sensed_suit: "cups", words: " x ", at: "2026-10-01T10:00:00Z" }));
  assert.ok(cleanPracticeRow({ card: "major-21", sensed_suit: "major", at: "2026-10-01T10:00:00Z" }));
  for (const bad of [{ card: "major-22", sensed_suit: "major", at: "2026-10-01" }, { card: "cups-11", sensed_suit: "cups", at: "2026-10-01" }, { card: "cups-2", sensed_suit: "fire", at: "2026-10-01" }, { card: "cups-2", sensed_suit: "cups" }]) {
    assert.equal(cleanPracticeRow(bad), null, JSON.stringify(bad));
  }
});

test("ideas 2 and 5: reminder days and the same question", () => {
  assert.equal(lookBackDay("2026-10-22", "week"), "2026-10-29");
  assert.equal(lookBackDay("2026-12-15", "month"), "2027-01-14");
  assert.equal(cleanLookBackDay("2026-02-30"), undefined);
  assert.equal(cleanLookBackDay(null), null);
  assert.equal(cleanLookBackDay("2026-11-01"), "2026-11-01");
  assert.equal(questionKey("  Should I   move? "), questionKey("should i move?"));
  assert.equal(questionKey("   "), null);
  const sql = readFileSync(new URL("../lib/reading-extras.ts", import.meta.url), "utf8");
  assert.match(sql, /lower\(regexp_replace\(trim\(d\.question\), '\\\\s\+', ' ', 'g'\)\)/, "the SQL key matches questionKey");
});

test("idea 7: the example is labelled and never stored", () => {
  const e = examplePatterns();
  assert.equal(e.example, true);
  assert.equal(e.when.total, 30);
  const route = readFileSync(new URL("../app/api/patterns/route.ts", import.meta.url), "utf8");
  assert.match(route, /examplePatterns\(\)/);
  const lib = readFileSync(new URL("../lib/patterns-example.ts", import.meta.url), "utf8");
  assert.ok(!/from "\.\/db"/.test(lib), "the example touches no database");
});

test("idea 8: the yearly review is the person's words, quoted so they cannot break the file", () => {
  assert.ok(isReviewYear(2026, new Date("2026-10-22T00:00:00Z")));
  assert.ok(!isReviewYear(2027, new Date("2026-10-22T00:00:00Z")));
  const md = formatYearReview({
    year: 2026,
    readingsByTool: [{ tool: "Runes", count: 2 }],
    recurring: [{ name: "Raidho", tool: "Runes", days: ["2026-01-02", "2026-02-03"] }],
    shifts: [],
    guesses: [{ day: "2026-01-02", tool: "Runes", text: "# not a heading\na road", fit: "mostly", note: null }],
    predictions: [{ day: "2026-01-02", tool: "Runes", text: "a letter comes", outcome: null, note: null }],
  });
  assert.match(md, /^# My year of readings, 2026/);
  assert.match(md, /2 readings in all/);
  assert.match(md, /> # not a heading\n> a road/);
  assert.match(md, /Not looked back on yet/);
});

test("the companion reads a guess only when it is ticked, and adults-only features check the confirmation", () => {
  const access = readFileSync(new URL("../lib/claude-access.ts", import.meta.url), "utf8");
  assert.match(access, /adultConfirmed\(userId\)/);
  const prefs = readFileSync(new URL("../lib/prefs.ts", import.meta.url), "utf8");
  assert.match(prefs, /companionEnabled: row\.companion_enabled === 1 && adult/);
  const visibility = readFileSync(new URL("../lib/concept-visibility.ts", import.meta.url), "utf8");
  assert.match(visibility, /show_sensitive === true && \(await adultConfirmed\(userId\)\)/);
  const migration = readFileSync(new URL("../migrations/092_intuition_and_age.sql", import.meta.url), "utf8");
  assert.match(migration, /companion_ok BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /adult_confirmed SMALLINT NOT NULL DEFAULT 0/);
});
