import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADDABLE_NOW, ITEM_KINDS, KIND_LABELS, addDays, dayWindow, isValidDay, localDay, readingSnapshot, tallyReadingDays, tzOfSky } from "../lib/days-core";
import { daysMarkdown } from "../lib/export-days";

const NOW = new Date("2026-10-14T12:00:00Z");

test("a day must be a real calendar date, not before 2000, and not more than two days ahead", () => {
  assert.equal(isValidDay("2026-10-14", NOW), true);
  assert.equal(isValidDay("2026-10-16", NOW), true); // a time zone ahead of UTC
  assert.equal(isValidDay("2026-10-17", NOW), false);
  assert.equal(isValidDay("1999-12-31", NOW), false);
  assert.equal(isValidDay("2026-02-30", NOW), false);
  assert.equal(isValidDay("2026-13-01", NOW), false);
  assert.equal(isValidDay("2026-1-5", NOW), false);
  assert.equal(isValidDay("../../etc/passwd", NOW), false);
  assert.equal(isValidDay("2026-10-14; DROP TABLE users", NOW), false);
  assert.equal(isValidDay(undefined, NOW), false);
  assert.equal(isValidDay(20261014, NOW), false);
});

test("the day before and after, across month and year ends", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("a reading's day is the date in the time zone it was saved with, and UTC when there was none", () => {
  const at = "2026-10-14T23:30:00Z";
  assert.equal(localDay(at, "Europe/London"), "2026-10-15"); // 00:30 the next morning there (BST)
  assert.equal(localDay(at, "America/Chicago"), "2026-10-14");
  assert.equal(localDay(at, "Pacific/Auckland"), "2026-10-15");
  assert.equal(localDay(at, null), "2026-10-14");
  assert.equal(localDay(at, "Not/AZone"), "2026-10-14");
});

test("the window of instants searched for a day holds that day in every time zone", () => {
  const zones = ["Pacific/Kiritimati", "Pacific/Auckland", "Asia/Kolkata", "Europe/London", "America/Sao_Paulo", "America/Chicago", "Pacific/Pago_Pago"];
  const { from, to } = dayWindow("2026-10-14");
  for (const tz of zones) {
    // Every minute of that local day, sampled every 15 minutes, must be inside the window.
    for (let t = from.getTime() - 86_400_000; t < to.getTime() + 86_400_000; t += 15 * 60_000) {
      if (localDay(new Date(t).toISOString(), tz) === "2026-10-14") {
        assert.ok(t >= from.getTime() && t < to.getTime(), `${tz} at ${new Date(t).toISOString()} is outside the window`);
      }
    }
  }
});

test("a reading's snapshot holds what came up, the question, and only the person's own entries, and adds no meaning", () => {
  const text = readingSnapshot({
    question: "Should I move?",
    summary: "Fehu, Ansuz",
    layoutName: "Two runes",
    toolLabel: "Runes",
    entries: [
      { when: "2026-10-14", kind: "impression", thinkingMind: false, content: "The colour first." },
      { when: "2026-10-15", kind: "note", thinkingMind: true, content: "I think it is about work." },
    ],
  });
  assert.match(text, /^Runes, Two runes\./);
  assert.match(text, /Your question: Should I move\?/);
  assert.match(text, /What came up: Fehu, Ansuz/);
  assert.match(text, /You wrote, as what you noticed first on 2026-10-14: The colour first\./);
  assert.match(text, /on 2026-10-15 \(marked as your thinking mind\): I think it is about work\./);
  assert.equal(readingSnapshot({ question: null, summary: "", layoutName: null, toolLabel: "Scrying", entries: [] }), "Scrying.");
});

test("every kind the table allows can be added and has a label", () => {
  assert.deepEqual(ADDABLE_NOW, [...ITEM_KINDS]);
  for (const k of ITEM_KINDS) assert.ok(KIND_LABELS[k], `${k} has a label`);
  // The kinds are set in 057 and widened by later migrations (058 added the answer to a pattern question).
  const migration = readFileSync("migrations/057_days.sql", "utf8") + readFileSync("migrations/058_companion_patterns.sql", "utf8");
  for (const k of ITEM_KINDS) assert.ok(migration.includes(`'${k}'`), `${k} is allowed by the table`);
});

test("the export writes each day with the person's writing and what was kept, a snapshot's words, and a link's place", () => {
  const out = daysMarkdown([
    {
      day: "2026-10-14",
      writing: "A quiet day.",
      items: [
        { kind: "companion_note", mode: "snapshot", title: "Questions, written by Ember, an AI", text: "1. What did you notice first?", href: "/runes/4", added_at: "2026-10-14T10:00:00Z" },
        { kind: "reading", mode: "link", title: "Runes: Fehu", text: null, href: "/runes/4", added_at: "2026-10-14T11:00:00Z" },
      ],
    },
  ]).join("\n");
  assert.match(out, /## Your days/);
  assert.match(out, /### 2026-10-14\n\nA quiet day\./);
  assert.match(out, /#### Kept answer: Questions, written by Ember, an AI \(snapshot\)\n\n1\. What did you notice first\?/);
  assert.match(out, /#### Reading: Runes: Fehu \(live link\)/);
  assert.match(out, /Where it lives in the app: \/runes\/4/);
  assert.deepEqual(daysMarkdown([]), []);
});

test("the day pages that run in the browser import no database code", () => {
  for (const f of ["components/DayView.tsx", "components/AddToDay.tsx", "app/days/today/page.tsx"]) {
    const imports = readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("import ") && !l.startsWith("import type"));
    assert.ok(!imports.some((l) => /lib\/(days|db)"|\/db"|pg"/.test(l)), `${f} imports no database code`);
  }
});

test("a reading's time zone is read from its saved sky, and anything unreadable is none", () => {
  assert.equal(tzOfSky(JSON.stringify({ tz: "Australia/Sydney" })), "Australia/Sydney");
  assert.equal(tzOfSky(null), null);
  assert.equal(tzOfSky("not json"), null);
  assert.equal(tzOfSky(JSON.stringify({ tz: 5 })), null);
});

test("readings are grouped by the day they were made on in their own time zone, with each tool once in the order first used", () => {
  const sydney = JSON.stringify({ tz: "Australia/Sydney" });
  const tally = tallyReadingDays([
    { kind: "runes", at: "2026-10-14T20:00:00.000Z", sky: null },
    { kind: "tarot", at: "2026-10-14T09:00:00.000Z", sky: null },
    { kind: "tarot", at: "2026-10-14T10:00:00.000Z", sky: null },
    // 20:00 UTC on the 14th is the morning of the 15th in Sydney.
    { kind: "ogham", at: "2026-10-14T20:00:00.000Z", sky: sydney },
  ]);
  assert.deepEqual(tally.get("2026-10-14"), { count: 3, kinds: ["tarot", "runes"] });
  assert.deepEqual(tally.get("2026-10-15"), { count: 1, kinds: ["ogham"] });
  assert.equal(tally.size, 2);
});
