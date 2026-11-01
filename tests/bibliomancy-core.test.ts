import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SOURCES,
  MAX_CONTEXT,
  MAX_PASSAGE,
  MAX_PULLS,
  SOURCE_KINDS,
  SOURCE_WORDS,
  UNITS,
  UNIT_WORDS,
  cleanPullCount,
  cleanSources,
  isUnit,
  plainText,
  pullSummary,
  sentencesOf,
  uniformIndex,
  unitsOf,
  weightedIndex,
} from "../lib/bibliomancy-core";

test("markdown is taken off so a pulled word is a word", () => {
  assert.equal(plainText("## Heading\n\n**Bold** and _soft_ and `code`, see [my page](https://example.com/x)."), "Heading\n\nBold and soft and code, see my page.");
  assert.equal(plainText("- one\n- two\n1. three\n> quoted"), "one\ntwo\nthree\nquoted");
  assert.equal(plainText("before ```\nhidden\n``` after"), "before after");
});

test("a text is split into sentences at the marks and at new lines", () => {
  assert.deepEqual(sentencesOf("The moon was up. I did not sleep! Why? Because — well, it was loud.\nA new line stands alone"), [
    "The moon was up.",
    "I did not sleep!",
    "Why?",
    "Because — well, it was loud.",
    "A new line stands alone",
  ]);
  assert.deepEqual(sentencesOf("ok. a. 1. 22."), [], "nothing with fewer than three letters counts");
  assert.deepEqual(sentencesOf("She said “stop.” Then left."), ["She said “stop.”", "Then left."]);
});

test("a word is four letters or more, with its sentence around it", () => {
  const u = unitsOf("The old moon rose, over Ninth Street.", "word");
  assert.deepEqual(u.map((x) => x.passage), ["moon", "rose", "over", "Ninth", "Street"]);
  assert.ok(u.every((x) => x.context === "The old moon rose, over Ninth Street."));
  assert.deepEqual(unitsOf("Don't re-read it's well-known", "word").map((x) => x.passage), ["Don't", "re-read", "well-known"]);
  assert.deepEqual(unitsOf("a b c 123 45", "word"), []);
});

test("a phrase is a stretch of two or more words between marks", () => {
  const u = unitsOf("When the rain came, we ran (fast) to the old mill — quietly.", "phrase");
  // "we ran" is two words but only five letters, and "quietly" is one word: neither is a phrase.
  assert.deepEqual(u.map((x) => x.passage), ["When the rain came", "to the old mill"]);
  assert.ok(u.every((x) => x.context?.startsWith("When the rain came")));
  assert.deepEqual(unitsOf("One. Two.", "phrase"), []);
});

test("a sentence is its own passage with no separate context", () => {
  assert.deepEqual(unitsOf("First one here. Second one there.", "sentence"), [
    { passage: "First one here.", context: null },
    { passage: "Second one there.", context: null },
  ]);
});

test("a very long sentence is cut to the limits", () => {
  const long = `${"word ".repeat(400).trim()}.`;
  assert.ok(unitsOf(long, "sentence")[0].passage.length <= MAX_PASSAGE);
  assert.ok(unitsOf(long, "word")[0].context!.length <= MAX_CONTEXT);
});

test("weighted choice follows the weights and never picks a zero weight", () => {
  const counts = [0, 0, 0];
  const grid = 1000;
  for (let i = 0; i < grid; i++) counts[weightedIndex([1, 0, 3], () => (i + 0.5) / grid)]++;
  assert.deepEqual(counts, [250, 0, 750]);
  assert.equal(weightedIndex([], () => 0.5), -1);
  assert.equal(weightedIndex([0, 0], () => 0.5), -1);
  assert.equal(weightedIndex([2, 2], () => 1), 1, "a random function that returns its upper bound still lands inside");
  assert.equal(uniformIndex(5, () => 0.999999), 4);
  assert.equal(uniformIndex(0, () => 0.3), -1);
});

test("the request is checked: places, units and how many", () => {
  assert.deepEqual(cleanSources(["day", "nonsense", "journal", "day"]), ["journal", "day"]);
  assert.deepEqual(cleanSources("journal"), []);
  assert.deepEqual(DEFAULT_SOURCES, ["journal", "day", "notes"]);
  assert.ok(isUnit("word") && isUnit("phrase") && isUnit("sentence") && !isUnit("page") && !isUnit(3));
  assert.equal(cleanPullCount(1), 1);
  assert.equal(cleanPullCount("3"), 3);
  assert.equal(cleanPullCount(MAX_PULLS), MAX_PULLS);
  assert.equal(cleanPullCount(0), null);
  assert.equal(cleanPullCount(MAX_PULLS + 1), null);
  assert.equal(cleanPullCount(1.5), null);
  assert.equal(cleanPullCount(""), null);
  for (const k of SOURCE_KINDS) assert.ok(SOURCE_WORDS[k].label && SOURCE_WORDS[k].hint);
  for (const u of UNITS) assert.ok(UNIT_WORDS[u].label && UNIT_WORDS[u].hint);
});

test("the summary quotes the passages and stays short", () => {
  assert.equal(pullSummary(["moon", "the old mill"]), "“moon”, “the old mill”");
  assert.ok(pullSummary(["x".repeat(900)]).length <= 400);
});

test("the pure file imports nothing, so the form can use it", () => {
  assert.deepEqual([...readFileSync(new URL("../lib/bibliomancy-core.ts", import.meta.url), "utf8").matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), []);
});

test("the pure file has no regular-expression look-behind, which older phones cannot read", () => {
  assert.doesNotMatch(readFileSync(new URL("../lib/bibliomancy-core.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, ""), /\(\?<[=!]/);
});
