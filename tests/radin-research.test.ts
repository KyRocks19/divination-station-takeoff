import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RADIN_INTRO, RADIN_SECTIONS, RADIN_SOURCES, getRadinSource } from "../lib/radin-research";
import { PRIMARY_SOURCES, primaryHref } from "../lib/primary-sources";

const paragraphs = [...RADIN_INTRO, ...RADIN_SECTIONS.flatMap((s) => s.paragraphs)];

test("every Radin source has a unique id, a secure link and a note on how it was checked", () => {
  const ids = new Set<string>();
  for (const s of RADIN_SOURCES) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.match(s.url, /^https:\/\//, `${s.id} link`);
    assert.ok(s.cite.length > 20 && s.note.length > 20 && s.urlLabel.length > 3, `${s.id} text`);
  }
});

test("every cited source exists, and every source is cited somewhere", () => {
  const cited = new Set<string>();
  for (const p of paragraphs) {
    for (const id of p.cites) {
      assert.ok(getRadinSource(id), `unknown source ${id}`);
      cited.add(id);
    }
  }
  for (const s of RADIN_SOURCES) assert.ok(cited.has(s.id), `${s.id} is never cited`);
});

test("only the closing note about the app goes without a source", () => {
  const uncited = paragraphs.filter((p) => p.cites.length === 0);
  assert.equal(uncited.length, 1);
  assert.match(uncited[0].text, /this app/);
});

test("the page gives both sides: his work, tests of it, criticism and his reply", () => {
  const kinds = new Set(RADIN_SOURCES.map((s) => s.kind));
  for (const k of ["his work", "a test of his work", "criticism", "his reply"] as const) assert.ok(kinds.has(k), k);
});

test("the wording never states psi as proven or dismisses it", () => {
  for (const p of paragraphs) {
    assert.doesNotMatch(p.text, /\b(proves?|proven|scientifically shown|superstition|debunk\w*|pseudoscien\w*)\b/i, p.text.slice(0, 60));
  }
});

test("the Sources page links to the Radin page near its top, as the first primary source", () => {
  const page = readFileSync(new URL("../app/sources/page.tsx", import.meta.url), "utf8");
  const primaries = page.indexOf("PRIMARY_SOURCES.map");
  assert.ok(primaries > 0, "the primary sources are listed");
  assert.ok(primaries < page.indexOf("Three tests"), "the list comes before the three tests");
  assert.equal(PRIMARY_SOURCES[0].id, "radin");
  assert.equal(primaryHref(PRIMARY_SOURCES[0]), "/sources/radin");
});

test("the Real Magic section follows his background and gives a review from each side", () => {
  const i = RADIN_SECTIONS.findIndex((s) => s.id === "real-magic");
  assert.equal(i, 1);
  const cites = new Set(RADIN_SECTIONS[i].paragraphs.flatMap((p) => p.cites));
  for (const id of ["real-magic", "morck-spr", "scofield-2022"]) assert.ok(cites.has(id), id);
});
