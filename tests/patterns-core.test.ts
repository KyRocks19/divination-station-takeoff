import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECURRING_MAX_ENTRIES, distinctVersions, partOfDay, recurringSymbols, themesByMonth, whenCounts, wordingShifts, type DrawRow, topThemes,
} from "../lib/patterns-core";

const row = (kind: DrawRow["kind"], key: string, name: string, id: number, date: string, reading: number | null = null): DrawRow => ({
  kind, key, name, divination_id: id, reading_id: reading, created_at: date,
});

test("a symbol in two or more different readings is listed, once per reading, with dates and links", () => {
  const rows = [
    row("runes", "ansuz", "Ansuz", 1, "2026-03-02T10:00:00Z"),
    row("runes", "ansuz", "Ansuz", 5, "2026-06-09T10:00:00Z"),
    row("runes", "ansuz", "Ansuz", 5, "2026-06-09T10:00:00Z"), // the same reading again: counts once
    row("runes", "fehu", "Fehu", 2, "2026-03-03T10:00:00Z"), // only once: not listed
    row("tarot", "major-16", "The Tower", 8, "2026-04-01T10:00:00Z", 31),
    row("tarot", "major-16", "The Tower", 9, "2026-05-01T10:00:00Z", 32),
    row("tarot", "major-16", "The Tower", 10, "2026-07-01T10:00:00Z", 33),
  ];
  const out = recurringSymbols(rows);
  assert.deepEqual(out.map((o) => [o.name, o.count]), [["The Tower", 3], ["Ansuz", 2]]);
  assert.deepEqual(out[0].entries.map((e) => e.href), ["/readings/31", "/readings/32", "/readings/33"]);
  assert.deepEqual(out[1].entries.map((e) => e.href), ["/runes/1", "/runes/5"]);
  assert.equal(out[1].earlier, 0);
});

test("the same key in two tools is two symbols, and a long history lists the latest readings and says how many came earlier", () => {
  const rows = [row("runes", "x", "Rune X", 1, "2026-01-01T00:00:00Z"), row("ogham", "x", "Stave X", 2, "2026-01-02T00:00:00Z")];
  assert.equal(recurringSymbols(rows).length, 0);
  const many = Array.from({ length: RECURRING_MAX_ENTRIES + 5 }, (_, i) => row("dice", "d6:3", "d6 showing 3", i + 1, `2026-02-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`));
  const [one] = recurringSymbols(many);
  assert.equal(one.count, RECURRING_MAX_ENTRIES + 5);
  assert.equal(one.entries.length, RECURRING_MAX_ENTRIES);
  assert.equal(one.earlier, 5);
});

test("wordings come back oldest first, blank ones dropped, and a repeat of the one before is not a change", () => {
  const v = distinctVersions([
    { when: "2026-09-01", text: "  late wording " },
    { when: "2026-03-01", text: "first wording" },
    { when: "2026-06-01", text: "first wording" },
    { when: "2026-07-01", text: "   " },
    { when: "2026-08-01", text: "middle wording" },
  ]);
  assert.deepEqual(v.map((x) => x.text), ["first wording", "middle wording", "late wording"]);
  // Going back to an earlier wording is a change and stays.
  assert.equal(distinctVersions([{ when: "1", text: "a" }, { when: "2", text: "b" }, { when: "3", text: "a" }]).length, 3);
});

test("only things worded at least twice, differently, are shown, the most recently changed first", () => {
  const out = wordingShifts([
    { kind: "runes", key: "a", name: "Anchor", versions: [{ when: "2026-03-01", text: "relief" }, { when: "2026-10-01", text: "heavy" }] },
    { kind: "runes", key: "b", name: "Bough", versions: [{ when: "2026-01-01", text: "same" }, { when: "2026-02-01", text: "same" }] },
    { kind: null, key: "c", name: "Cairn", versions: [{ when: "2026-05-01", text: "one" }] },
    { kind: "ogham", key: "d", name: "Dair", versions: [{ when: "2026-04-01", text: "x" }, { when: "2026-05-01", text: "y" }] },
  ]);
  assert.deepEqual(out.map((o) => o.name), ["Anchor", "Dair"]);
  assert.deepEqual(out[0].versions.map((v) => v.text), ["relief", "heavy"]);
});

test("themes by month: newest first, most frequent first, names in order on ties, and months with nothing are left out", () => {
  const names: Record<string, string> = { a: "Beginnings", b: "Home", c: "Letting go" };
  const months = new Map<string, Map<string, number>>([
    ["2026-03", new Map([["a", 2], ["b", 5]])],
    ["2026-10", new Map([["c", 3], ["a", 3], ["zzz", 9]])], // an unknown theme is dropped
    ["2026-05", new Map()],
  ]);
  const out = themesByMonth(months, (s) => names[s] ?? null);
  assert.deepEqual(out.map((m) => m.month), ["2026-10", "2026-03"]);
  assert.deepEqual(out[0].themes.map((t) => t.name), ["Beginnings", "Letting go"]);
  assert.deepEqual(out[1].themes.map((t) => [t.name, t.count]), [["Home", 5], ["Beginnings", 2]]);
});

test("the part of the day follows the time zone the reading was saved with, and is left out when there is none", () => {
  assert.equal(partOfDay("2026-10-14T08:30:00Z", "Europe/London"), "Early morning (5am to noon)");
  assert.equal(partOfDay("2026-10-14T08:30:00Z", "Pacific/Auckland"), "Evening (5pm to 10pm)"); // 21:30 there
  assert.equal(partOfDay("2026-10-14T13:30:00Z", "Europe/London"), "Afternoon (noon to 5pm)");
  assert.equal(partOfDay("2026-10-14T23:30:00Z", "Europe/London"), "Night (10pm to 5am)");
  assert.equal(partOfDay("2026-10-14T08:30:00Z", null), null);
  assert.equal(partOfDay("2026-10-14T08:30:00Z", "Not/AZone"), null);
});

test("when-you-read counts readings by weekday, moon phase, festival, and part of the day, in a fixed order, and says what was left out", () => {
  const sky = (weekday: string, moonPhase: string, wheelPrevious: string, tz: string | null) => ({ weekday, moonPhase, wheelPrevious, tz });
  const out = whenCounts(
    [
      { created_at: "2026-10-14T08:30:00Z", sky: sky("Wednesday", "Full Moon", "Mabon", "Europe/London") },
      { created_at: "2026-10-12T20:00:00Z", sky: sky("Monday", "Full Moon", "Mabon", "Europe/London") },
      { created_at: "2026-03-02T01:00:00Z", sky: sky("Monday", "New Moon", "Imbolc", null) },
      { created_at: "2026-01-01T00:00:00Z", sky: null },
    ],
    ["New Moon", "Full Moon"]
  );
  assert.equal(out.total, 4);
  assert.equal(out.noSky, 1);
  assert.equal(out.noTimeZone, 1);
  assert.deepEqual(out.weekday, [{ label: "Monday", count: 2 }, { label: "Wednesday", count: 1 }]);
  assert.deepEqual(out.moonPhase, [{ label: "New Moon", count: 1 }, { label: "Full Moon", count: 2 }]);
  assert.deepEqual(out.festival, [{ label: "Imbolc", count: 1 }, { label: "Mabon", count: 2 }]);
  assert.deepEqual(out.partOfDay, [{ label: "Early morning (5am to noon)", count: 1 }, { label: "Evening (5pm to 10pm)", count: 1 }]);
});

test("the home page's top themes: every side and every tool counted, most often first, ties by name, limited", () => {
  const tallies = [
    { slug: "a", name: "Zeal", byTool: { runes: { light: 1, shadow: 1, either: 0 }, tarot: { light: 0, shadow: 0, either: 2 } } },
    { slug: "b", name: "Ache", byTool: { tarot: { light: 2, shadow: 0, either: 2 } } },
    { slug: "c", name: "Calm", byTool: { dice: { light: 1, shadow: 0, either: 0 } } },
    { slug: "d", name: "Never", byTool: {} },
    { slug: "e", name: "Bold", byTool: { ogham: { light: 0, shadow: 0, either: 1 } } },
  ];
  assert.deepEqual(topThemes(tallies).map((t) => [t.name, t.count]), [["Ache", 4], ["Zeal", 4], ["Bold", 1], ["Calm", 1]]);
  assert.equal(topThemes(tallies, 2).length, 2);
  assert.deepEqual(topThemes([]), []);
});
