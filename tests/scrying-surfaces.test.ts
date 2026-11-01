import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMinutes, MAX_SCRYING_MINUTES, minutesInWords, parseMinutesText } from "../lib/scrying-surfaces";

test("typed minutes: whole numbers only, empty and odd input give null", () => {
  assert.equal(parseMinutesText("10"), 10);
  assert.equal(parseMinutesText("  7 "), 7);
  assert.equal(parseMinutesText("0"), 0);
  for (const bad of ["", "  ", "1.5", "-3", "+3", "ten", "1e2", "10 min", "12345"]) {
    assert.equal(parseMinutesText(bad), null, bad);
  }
});

test("typed minutes: the lowest allowed number is a parameter, and a day is the most", () => {
  assert.equal(parseMinutesText("0", 1), null);
  assert.equal(parseMinutesText("1", 1), 1);
  assert.equal(parseMinutesText(String(MAX_SCRYING_MINUTES)), MAX_SCRYING_MINUTES);
  assert.equal(parseMinutesText(String(MAX_SCRYING_MINUTES + 1)), null);
});

test("what the page accepts, the server accepts", () => {
  for (const n of [0, 1, 45, MAX_SCRYING_MINUTES]) assert.equal(cleanMinutes(parseMinutesText(String(n))), n);
});

test("minutes in words", () => {
  assert.equal(minutesInWords(0), "less than a minute");
  assert.equal(minutesInWords(1), "about 1 minute");
  assert.equal(minutesInWords(12), "about 12 minutes");
});
