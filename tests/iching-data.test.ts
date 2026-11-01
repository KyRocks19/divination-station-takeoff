import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAST_METHODS,
  COIN_WEIGHTS,
  HEXAGRAMS,
  LINE_VALUES,
  TRIGRAMS,
  YARROW_WEIGHTS,
  castLine,
  castLines,
  castSummary,
  changingWords,
  cleanLineValues,
  getHexagram,
  hexagramOfLines,
  linesToText,
  resultOf,
  trigramWords,
  type LineValue,
} from "../lib/iching-data";

test("there are 64 hexagrams, each once, with their own lines", () => {
  assert.equal(HEXAGRAMS.length, 64);
  assert.deepEqual(HEXAGRAMS.map((h) => h.n), Array.from({ length: 64 }, (_, i) => i + 1));
  assert.equal(new Set(HEXAGRAMS.map((h) => h.lines.map(Number).join(""))).size, 64);
  assert.equal(new Set(HEXAGRAMS.map((h) => h.pinyin + h.char)).size, 64, "no two share a name");
  for (const h of HEXAGRAMS) {
    assert.equal(h.id, `hexagram-${h.n}`);
    assert.equal(h.lines.length, 6);
    assert.ok(h.char && h.pinyin && h.english);
  }
});

test("the King Wen sequence comes in pairs: each even hexagram is the one before it turned upside down, or with every line flipped when turning changes nothing", () => {
  for (let n = 1; n <= 63; n += 2) {
    const a = HEXAGRAMS[n - 1].lines;
    const b = HEXAGRAMS[n].lines;
    const upsideDown = [...a].reverse();
    const palindrome = a.every((v, i) => v === upsideDown[i]);
    const expected = palindrome ? a.map((v) => !v) : upsideDown;
    assert.deepEqual(b, expected, `hexagrams ${n} and ${n + 1}`);
  }
});

test("known hexagrams have the numbers, names and trigrams the tradition gives them", () => {
  const check = (n: number, pinyin: string, lower: string, upper: string) => {
    const h = getHexagram(n)!;
    assert.equal(h.pinyin, pinyin, `${n} name`);
    assert.equal(h.lower, lower, `${n} lower`);
    assert.equal(h.upper, upper, `${n} upper`);
  };
  check(1, "Qián", "qian", "qian");
  check(2, "Kūn", "kun", "kun");
  check(3, "Zhūn", "zhen", "kan");
  check(4, "Méng", "kan", "gen");
  check(11, "Tài", "qian", "kun");
  check(12, "Pǐ", "kun", "qian");
  check(29, "Kǎn", "kan", "kan");
  check(30, "Lí", "li", "li");
  check(49, "Gé", "li", "dui");
  check(51, "Zhèn", "zhen", "zhen");
  check(63, "Jì Jì", "li", "kan");
  check(64, "Wèi Jì", "kan", "li");
  assert.equal(trigramWords(getHexagram(11)!), "Earth over Heaven");
});

test("the 8 trigrams are the 8 different sets of three lines", () => {
  assert.equal(TRIGRAMS.length, 8);
  assert.equal(new Set(TRIGRAMS.map((t) => t.lines.map(Number).join(""))).size, 8);
});

test("a hexagram is found by number or id, and a bad one is not found", () => {
  assert.equal(getHexagram("hexagram-7")?.n, 7);
  assert.equal(getHexagram(64)?.n, 64);
  assert.equal(getHexagram(0), undefined);
  assert.equal(getHexagram(65), undefined);
  assert.equal(getHexagram("hexagram-65"), undefined);
  assert.equal(getHexagram("rune-fehu"), undefined);
  assert.equal(hexagramOfLines(HEXAGRAMS[41].lines).n, 42);
});

test("odds: the line weights add to 16, and the coin and yarrow methods differ", () => {
  const sum = (w: Record<LineValue, number>) => LINE_VALUES.reduce((n, v) => n + w[v], 0);
  assert.equal(sum(COIN_WEIGHTS), 16);
  assert.equal(sum(YARROW_WEIGHTS), 16);
  assert.notDeepEqual(COIN_WEIGHTS, YARROW_WEIGHTS);
  assert.deepEqual(CAST_METHODS, ["coins", "yarrow", "entered"]);
});

test("casting follows the odds: every outcome of the random function maps to a line value, with the stated shares", () => {
  // Walk the random function over an even grid; the share of each value is its weight out of 16 (yarrow) or follows the eight coin patterns.
  const grid = 4096;
  const yarrow: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < grid; i++) yarrow[castLine("yarrow", () => (i + 0.5) / grid)]++;
  for (const v of LINE_VALUES) assert.equal(yarrow[v], (YARROW_WEIGHTS[v] / 16) * grid, `yarrow ${v}`);

  const coin: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
  // Eight equally likely patterns of three coins.
  for (let p = 0; p < 8; p++) {
    const bits = [p & 1, (p >> 1) & 1, (p >> 2) & 1];
    let k = 0;
    coin[castLine("coins", () => (bits[k++] ? 0.25 : 0.75))]++;
  }
  for (const v of LINE_VALUES) assert.equal(coin[v] * 2, COIN_WEIGHTS[v], `coins ${v}`);
});

test("six lines are cast bottom to top and are always valid", () => {
  let x = 0.1;
  const lines = castLines("coins", () => (x = (x * 7.31 + 0.137) % 1));
  assert.equal(lines.length, 6);
  assert.ok(lines.every((v) => LINE_VALUES.includes(v)));
});

test("the six lines the person enters are checked", () => {
  assert.deepEqual(cleanLineValues("789678"), [7, 8, 9, 6, 7, 8]);
  assert.deepEqual(cleanLineValues([7, 7, 7, 7, 7, 7]), [7, 7, 7, 7, 7, 7]);
  assert.equal(cleanLineValues("78967"), null);
  assert.equal(cleanLineValues("7896789"), null);
  assert.equal(cleanLineValues("789650"), null);
  assert.equal(cleanLineValues([7, 8, 9, 6, 7, "x"]), null);
  assert.equal(cleanLineValues(undefined), null);
  assert.equal(linesToText([7, 8, 9, 6, 7, 8]), "789678");
});

test("changing lines turn the first hexagram into the second", () => {
  // Six young yang lines: hexagram 1, nothing changing.
  const still = resultOf([7, 7, 7, 7, 7, 7]);
  assert.equal(still.primary.n, 1);
  assert.equal(still.relating, null);
  assert.deepEqual(still.changing, []);
  // All old yang: hexagram 1 becomes hexagram 2.
  const all = resultOf([9, 9, 9, 9, 9, 9]);
  assert.equal(all.primary.n, 1);
  assert.equal(all.relating?.n, 2);
  assert.deepEqual(all.changing, [1, 2, 3, 4, 5, 6]);
  // The bottom line of hexagram 1 old (9): the line becomes yin, which is hexagram 44.
  const one = resultOf([9, 7, 7, 7, 7, 7]);
  assert.equal(one.relating?.n, 44);
  assert.deepEqual(one.changing, [1]);
  // An old yin line turns solid: hexagram 2 with its top line old becomes hexagram 23 (a solid line over five broken ones).
  const top = resultOf([8, 8, 8, 8, 8, 6]);
  assert.equal(top.primary.n, 2);
  assert.equal(top.relating?.n, 23);
});

test("the summary and the words for the changing lines", () => {
  assert.equal(castSummary([7, 7, 7, 7, 7, 7]), "Hexagram 1 Qián (The Creative), no changing lines");
  assert.match(castSummary([9, 7, 7, 7, 7, 7]), /^Hexagram 1 Qián \(The Creative\), changing to 44 Gòu \(Coming to meet\)$/);
  assert.equal(changingWords([]), "No line is changing");
  assert.equal(changingWords([3]), "Line 3 is changing");
  assert.equal(changingWords([2, 5]), "Lines 2 and 5 are changing");
  assert.equal(changingWords([1, 3, 6]), "Lines 1, 3 and 6 are changing");
});
