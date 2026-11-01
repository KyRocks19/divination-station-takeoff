import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_FOR_PERCENT, answered, cleanCheckOn, cleanPredictionText, emptyTally, percentages, tallyByKind } from "../lib/predictions";

test("cleanCheckOn accepts real dates, null for empty, undefined for nonsense", () => {
  assert.equal(cleanCheckOn("2026-12-31"), "2026-12-31");
  assert.equal(cleanCheckOn(""), null);
  assert.equal(cleanCheckOn(null), null);
  assert.equal(cleanCheckOn("2026-02-30"), undefined);
  assert.equal(cleanCheckOn("31/12/2026"), undefined);
  assert.equal(cleanCheckOn("1850-01-01"), undefined);
  assert.equal(cleanCheckOn(20261231), undefined);
});

test("cleanPredictionText trims, refuses empty and too long", () => {
  assert.deepEqual(cleanPredictionText("  I expect a call  "), { ok: true, text: "I expect a call" });
  assert.equal(cleanPredictionText("   ").ok, false);
  assert.equal(cleanPredictionText(5).ok, false);
  assert.equal(cleanPredictionText("x".repeat(2001)).ok, false);
});

test("a percentage appears only after enough answers, and 'can't tell' is left out", () => {
  const few = { ...emptyTally(), yes: 3, no: 2, unclear: 50 };
  assert.equal(answered(few), 5);
  assert.equal(percentages(few), null);
  const enough = { ...emptyTally(), yes: 5, partly: 2, no: 3, unclear: 9, open: 4 };
  assert.equal(answered(enough), MIN_FOR_PERCENT);
  assert.deepEqual(percentages(enough), { yes: 50, partly: 20, no: 30 });
});

test("tallyByKind counts per tool and counts unanswered ones as open", () => {
  const t = tallyByKind([
    { kind: "runes", outcome: "yes" },
    { kind: "runes", outcome: null },
    { kind: "tarot", outcome: "unclear" },
    { kind: "runes", outcome: "no" },
  ]);
  assert.deepEqual(t.get("runes"), { yes: 1, partly: 0, no: 1, unclear: 0, open: 1 });
  assert.deepEqual(t.get("tarot"), { yes: 0, partly: 0, no: 0, unclear: 1, open: 0 });
  assert.equal(t.get("dice"), undefined);
});
