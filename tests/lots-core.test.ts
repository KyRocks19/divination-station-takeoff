import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_DRAW_LOTS, MAX_LOT_NAME, MAX_PASTE_NAMES, bagWords, cleanLotCount, namesFromText } from "../lib/lots-core";

test("a pasted list gives one name to a line, trimmed, without blanks or repeats", () => {
  const r = namesFromText("  Ana \n\nBen\r\nana\n  Cy   Lee  \n");
  assert.deepEqual(r.names, ["Ana", "Ben", "Cy Lee"]);
  assert.equal(r.repeats, 1);
  assert.equal(r.tooLong, 0);
});

test("names that are too long are counted and left out, and a paste stops at the limit", () => {
  assert.deepEqual(namesFromText("x".repeat(MAX_LOT_NAME + 1)).names, []);
  assert.equal(namesFromText("x".repeat(MAX_LOT_NAME + 1)).tooLong, 1);
  const many = Array.from({ length: MAX_PASTE_NAMES + 5 }, (_, i) => `n${i}`).join("\n");
  const r = namesFromText(many);
  assert.equal(r.names.length, MAX_PASTE_NAMES);
  assert.equal(r.over, 5);
  assert.deepEqual(namesFromText(42).names, []);
});

test("a draw takes between one and the number in the bag, and at most the draw limit", () => {
  assert.equal(cleanLotCount(3, 10), 3);
  assert.equal(cleanLotCount("4", 10), 4);
  assert.equal(cleanLotCount(10, 10), 10);
  assert.equal(cleanLotCount(11, 10), null);
  assert.equal(cleanLotCount(MAX_DRAW_LOTS + 1, 100), null);
  assert.equal(cleanLotCount(MAX_DRAW_LOTS, 100), MAX_DRAW_LOTS);
  for (const bad of [0, -1, 1.5, "", "x", null, undefined]) assert.equal(cleanLotCount(bad, 10), null);
});

test("the bag is described in words", () => {
  assert.equal(bagWords(12, 0, "bag"), "12 in the bag");
  assert.equal(bagWords(9, 3, "pouch"), "9 in the pouch, 3 set aside");
});

test("the routes that add, draw and put back are signed-in and scoped to the person", () => {
  for (const file of ["app/api/oracle/cards/bulk/route.ts", "app/api/oracle/decks/[id]/wake/route.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.match(src, /if \(!session\.userId\) return Response\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/, file);
    assert.match(src, /user_id = \$/, `${file} scopes by person`);
  }
  const pulls = readFileSync("app/api/oracle/pulls/route.ts", "utf8");
  assert.match(pulls, /UPDATE oracle_cards SET resting = 1 WHERE user_id = \$1 AND deck_id = \$2/);
});
