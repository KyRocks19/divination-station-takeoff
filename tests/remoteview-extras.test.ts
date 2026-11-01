import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAILY_OPTIONS, DAILY_SHAPES, IDEOGRAM_FORM, chanceOfAtLeast, cleanDailyChoice, practiceNumbers } from "../lib/remoteview-core";
import { cleanDrawing } from "../lib/oracle-art";
import { sealText } from "../lib/remoteview-daily";

test("daily trials have five shapes and choices 0 to 4", () => {
  assert.equal(DAILY_SHAPES.length, DAILY_OPTIONS);
  assert.equal(cleanDailyChoice(4), 4);
  for (const bad of [5, -1, 1.5, "2", null, undefined]) assert.equal(cleanDailyChoice(bad), null);
});

test("five options are judged against a fifth, four against a quarter", () => {
  const five = practiceNumbers(10, 2, 1 / 5);
  assert.equal(five.expected, 2);
  assert.ok(Math.abs(chanceOfAtLeast(1, 1, 0.2) - 0.2) < 1e-12);
  assert.equal(practiceNumbers(8, 2).expected, 2);
});

test("an ideogram is checked with the drawing board's own rules", () => {
  assert.equal(cleanDrawing({ background: "#1a1a2e", strokes: [{ c: "#ffffff", w: 8, p: [[1, 1], [20, 30]] }] }, IDEOGRAM_FORM).ok, true);
  assert.equal(cleanDrawing({ background: "red", strokes: [] }, IDEOGRAM_FORM).ok, false);
  assert.equal(cleanDrawing({ background: "#1a1a2e", strokes: [{ c: "#fff", w: 8, p: [[1, 1]] }] }, IDEOGRAM_FORM).ok, false);
});

test("the seal text joins the target and the secret number", () => {
  assert.equal(sealText(3, "ab12"), "3:ab12");
});

test("the pages and routes that touch sealed targets never select them early", () => {
  // The only file that reads a target or a nonce out of the database for a person to see is the one that decides when they may be shown.
  const daily = readFileSync("lib/remoteview-daily.ts", "utf8");
  assert.match(daily, /judged: r\.judged_at && r\.choice_index !== null \?/);
  const trial = readFileSync("lib/remoteview.ts", "utf8");
  assert.match(trial, /target_index: state === "judged" \? r\.target_index : null/);
  assert.match(trial, /options: state === "open" \? null : r\.options/);
  for (const file of ["app/api/remoteview/route.ts", "app/api/remoteview/daily/route.ts", "app/api/remoteview/share/route.ts"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /SELECT[^`"]*target_index/i, `${file} must not select a target`);
  }
});
