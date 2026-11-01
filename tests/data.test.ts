// Checks on the data files the tools are built from. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHETYPES, REALMS, getArchetype } from "../lib/archetypes-data";
import {
  RUNE_MEANINGS, OGHAM_MEANINGS, COIN_MEANINGS, PENDULUM_MEANINGS, SCRYING_MEANINGS, numberMeaning, reductionSteps,
} from "../lib/common-meanings-data";
import { RUNES, getRune } from "../lib/runes-data";
import { STAVES, getStave, stavesFor, maxDraw } from "../lib/ogham-data";
import { DICE_OBJECTS, facesOf, faceId, getFace, cleanThrowCount, totalOf, tallyCoin } from "../lib/dice-data";

test("archetypes: unique slugs, every one in a known realm, both sides written", () => {
  const slugs = ARCHETYPES.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(ARCHETYPES.length, 85);
  const realms = new Set((REALMS as readonly any[]).map((r) => (typeof r === "string" ? r : r.name ?? r.id ?? r.slug)));
  for (const a of ARCHETYPES) {
    assert.ok(a.name && a.summary && a.light && a.shadow, `${a.slug} is missing words`);
    assert.ok(realms.has(a.realm), `${a.slug} is in an unknown realm: ${a.realm}`);
  }
});

test("common meanings: every archetype they name exists, each has both sides", () => {
  const all = { ...RUNE_MEANINGS, ...OGHAM_MEANINGS, ...COIN_MEANINGS, ...PENDULUM_MEANINGS, ...SCRYING_MEANINGS };
  for (const [id, m] of Object.entries(all)) {
    assert.ok(m.keywords && m.light && m.shadow, `${id} is missing words`);
    assert.ok(m.archetypes.length >= 1 && m.archetypes.length <= 4, `${id} should name 1 to 4 archetypes`);
    for (const slug of m.archetypes) assert.ok(getArchetype(slug), `${id} names unknown archetype ${slug}`);
  }
});

test("runes: 24, unique ids, all with common meanings", () => {
  assert.equal(RUNES.length, 24);
  assert.equal(new Set(RUNES.map((r) => r.id)).size, 24);
  for (const r of RUNES) {
    assert.equal(getRune(r.id)?.id, r.id);
    assert.ok(RUNE_MEANINGS[r.id], `${r.id} has no common meaning`);
  }
});

test("ogham: 25 staves, 20 main letters, forfeda switch changes the pool", () => {
  assert.equal(STAVES.length, 25);
  assert.equal(stavesFor(false).length, 20);
  assert.equal(stavesFor(true).length, 25);
  assert.equal(maxDraw(false), 20);
  assert.equal(maxDraw(true), 25);
  for (const s of stavesFor(false)) assert.ok(OGHAM_MEANINGS[s.id], `${s.id} has no common meaning`);
  assert.equal(getStave("ogham-nope"), undefined);
});

test("dice: faces, ids, and counts", () => {
  for (const o of DICE_OBJECTS) {
    for (const face of facesOf(o.id)) {
      const parsed = getFace(faceId(o.id, face));
      assert.equal(parsed?.object, o.id);
      assert.equal(parsed?.face, face);
    }
  }
  assert.deepEqual(facesOf("coin"), ["heads", "tails"]);
  assert.equal(facesOf("d20").length, 20);
  assert.equal(getFace("die-d6-7"), undefined);
  assert.equal(getFace("die-d6-03"), undefined);
  assert.equal(cleanThrowCount("100"), 100);
  assert.equal(cleanThrowCount(101), null);
  assert.equal(cleanThrowCount(0), null);
  assert.equal(cleanThrowCount(2.5), null);
  assert.equal(totalOf("d6", ["3", "4"]), 7);
  assert.equal(totalOf("coin", ["heads"]), null);
  assert.deepEqual(tallyCoin(["heads", "tails", "heads"]), { heads: 2, tails: 1 });
});

test("numbers reduce as numerology does, keeping 11, 22, 33", () => {
  assert.equal(reductionSteps(7).result, 7);
  assert.equal(reductionSteps(19).result, 1);
  assert.equal(reductionSteps(11).result, 11);
  assert.equal(reductionSteps(22).result, 22);
  assert.equal(reductionSteps(33).result, 33);
  assert.ok(numberMeaning(3, 6).keywords);
});

import { SET_FORMS, FORM_WORDS, cleanForm, formWords, countOf } from "../lib/oracle-forms";

test("set forms: every form has words, unknown forms read as cards", () => {
  assert.deepEqual(SET_FORMS, ["cards", "stones", "staves", "charms"]);
  for (const f of SET_FORMS) {
    const w = FORM_WORDS[f];
    assert.ok(w.one && w.many && w.One && w.Many && w.group && w.Group && w.choice && w.intro);
    assert.equal(w.a, `a ${w.one}`);
    assert.equal(w.One, w.one[0].toUpperCase() + w.one.slice(1));
    assert.equal(w.Many, w.many[0].toUpperCase() + w.many.slice(1));
  }
  assert.equal(cleanForm("stones"), "stones");
  assert.equal(cleanForm("rocks"), null);
  assert.equal(cleanForm(3), null);
  assert.equal(formWords("rocks").one, "card");
  assert.equal(formWords(undefined).group, "deck");
  assert.equal(countOf("staves", 1), "1 stave");
  assert.equal(countOf("staves", 2), "2 staves");
  assert.equal(countOf("stones", 0), "0 stones");
});

import { cleanDrawing, drawingToSvg, sniffImage, strokePath, boardFor, isRound, cleanAlt } from "../lib/oracle-art";

test("art: drawings are checked and clipped to the board; the svg holds only checked values", () => {
  const ok = cleanDrawing({ background: "#1A1A2E", strokes: [{ c: "#FF40DE", w: 8, p: [[0, 0], [9999, -5], [10, 10]] }] }, "cards");
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.drawing.background, "#1a1a2e");
    assert.deepEqual(ok.drawing.strokes[0].p[1], [360, 0]);
    const svg = drawingToSvg(ok.drawing, "cards");
    assert.ok(svg.startsWith("<svg") && svg.includes('viewBox="0 0 360 504"'));
    assert.ok(!svg.includes("script"));
  }
  const bad = (d: unknown) => assert.equal(cleanDrawing(d, "stones").ok, false);
  bad(null);
  bad({ background: "red", strokes: [] });
  bad({ background: "#000000", strokes: "no" });
  bad({ background: "#000000", strokes: [{ c: "url(x)", w: 3, p: [[1, 1]] }] });
  bad({ background: "#000000", strokes: [{ c: "#000000", w: 99, p: [[1, 1]] }] });
  bad({ background: "#000000", strokes: [{ c: "#000000", w: 3, p: [] }] });
  bad({ background: "#000000", strokes: [{ c: "#000000", w: 3, p: [[1, "2"]] }] });
  bad({ background: "#000000", strokes: [{ c: "#000000", w: 3, p: [[NaN, 2]] }] });
  bad({ background: "#000000", strokes: Array.from({ length: 601 }, () => ({ c: "#000000", w: 3, p: [[1, 1]] })) });
  assert.ok(cleanDrawing({ background: "#000000", strokes: [] }, "stones").ok);
});

test("art: shapes follow the form, paths are well-formed", () => {
  assert.equal(boardFor("staves").w < boardFor("staves").h, true);
  assert.equal(boardFor("stones").w, boardFor("stones").h);
  assert.equal(boardFor("rocks").w, boardFor("cards").w);
  assert.equal(isRound("stones"), true);
  assert.equal(isRound("charms"), true);
  assert.equal(isRound("cards"), false);
  assert.equal(strokePath([]), "");
  assert.ok(strokePath([[5, 5]]).startsWith("M5 5"));
  assert.ok(strokePath([[0, 0], [10, 10], [20, 0], [30, 10]]).startsWith("M0 0Q"));
});

test("art: only JPEG, PNG, and WebP are recognised, by their first bytes", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("GIF89a")), null);
  assert.equal(sniffImage(new Uint8Array()), null);
  assert.equal(cleanAlt("  a stone  "), "a stone");
  assert.equal(cleanAlt("   "), null);
  assert.equal(cleanAlt("x".repeat(500))?.length, 300);
});
