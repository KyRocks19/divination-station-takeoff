import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOUR_STEPS } from "../lib/tour-steps";

test("the tour has a few short steps, each with a title and plain words, and every link stays on this site", () => {
  assert.ok(TOUR_STEPS.length >= 4 && TOUR_STEPS.length <= 7);
  for (const s of TOUR_STEPS) {
    assert.ok(s.title.length > 3 && s.title.length < 60);
    assert.ok(s.body.length > 40 && s.body.length < 700, `${s.title}: body length`);
    if (s.link) assert.ok(s.link.href.startsWith("/") && !s.link.href.startsWith("//"));
  }
  assert.equal(new Set(TOUR_STEPS.map((s) => s.title)).size, TOUR_STEPS.length);
});

test("the tour says the companion is off, that nothing is scored, and that the person's words come first", () => {
  const all = TOUR_STEPS.map((s) => `${s.title}. ${s.body}`).join(" ").toLowerCase();
  for (const needle of ["off until you turn it on", "nothing is scored", "your own words", "not crisis support"]) assert.ok(all.includes(needle), needle);
});

test("the tour card (a client component) does not import the database", () => {
  for (const f of ["components/TourCard.tsx", "lib/tour-steps.ts"]) {
    const imports = readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("import "));
    assert.ok(!imports.some((l) => /\/db"|lib\/tour"|pg"/.test(l)), `${f} imports no database code`);
  }
});
