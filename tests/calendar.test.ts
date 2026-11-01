import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_WHEEL, MAX_OWN_FESTIVALS, daySummaryText, festivalsFor, festivalsInMonth, isValidMonth, monthGrid, moonOn, nextFestival, parseWheel,
  readingFromPath, shiftMonth, topReading,
} from "../lib/calendar-core";
import { DIVINATION_KINDS, divinationPath } from "../lib/divination-kinds";

test("months are YYYY-MM and move across years", () => {
  assert.ok(isValidMonth("2026-10"));
  assert.ok(!isValidMonth("2026-13"));
  assert.ok(!isValidMonth("2026-1"));
  assert.ok(!isValidMonth(undefined));
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("a month's grid starts on its weekday and fills whole weeks", () => {
  const cells = monthGrid("2026-10"); // 1 October 2026 is a Thursday
  assert.equal(cells.length % 7, 0);
  assert.deepEqual(cells.slice(0, 5), [null, null, null, null, "2026-10-01"]);
  assert.equal(cells.filter(Boolean).length, 31);
  assert.equal(monthGrid("2024-02").filter(Boolean).length, 29);
});

test("the moon on a known full moon and new moon", () => {
  assert.equal(moonOn("2026-10-26").phase, "Full Moon");
  assert.equal(moonOn("2026-10-10").phase, "New Moon");
});

test("the usual eight follow the half of the world, and the person's changes apply", () => {
  const north = festivalsFor(EMPTY_WHEEL, "north");
  assert.equal(north.length, 8);
  assert.equal(north.find((f) => f.id === "samhain")?.date, "10-31");
  assert.equal(festivalsFor(EMPTY_WHEEL, "south").find((f) => f.id === "samhain")?.date, "05-01");

  const mine = festivalsFor({ hidden: ["yule"], names: { samhain: "Hallows" }, dates: { samhain: "11-01" }, own: [{ id: "own-a", name: "Gran's day", date: "10-12" }] }, "north");
  const samhain = mine.find((f) => f.id === "samhain")!;
  assert.equal(samhain.name, "Hallows");
  assert.equal(samhain.usualName, "Samhain");
  assert.equal(samhain.date, "11-01");
  assert.equal(samhain.usualDate, "10-31");
  assert.ok(mine.find((f) => f.id === "yule")!.hidden);

  const oct = festivalsInMonth("2026-10", mine);
  assert.equal(oct.get("2026-10-12")?.[0].name, "Gran's day");
  assert.equal(oct.get("2026-10-31"), undefined);
  assert.equal(festivalsInMonth("2026-12", mine).size, 0, "a hidden festival is not shown");
});

test("a 29 February day shows only in leap years", () => {
  const list = festivalsFor({ ...EMPTY_WHEEL, own: [{ id: "own-leap", name: "Leap", date: "02-29" }] }, "north");
  assert.equal(festivalsInMonth("2028-02", list).get("2028-02-29")?.[0].name, "Leap");
  assert.equal(festivalsInMonth("2027-02", list).size, 1, "only Imbolc in a year without the 29th");
});

test("the next festival counts today and wraps into next year", () => {
  const list = festivalsFor(EMPTY_WHEEL, "north");
  assert.deepEqual(nextFestival(list, "2026-10-31")?.festival.id, "samhain");
  assert.equal(nextFestival(list, "2026-10-31")?.inDays, 0);
  assert.equal(nextFestival(list, "2026-12-25")?.festival.id, "imbolc");
  assert.equal(nextFestival(festivalsFor({ ...EMPTY_WHEEL, hidden: list.map((f) => f.id) }, "north"), "2026-10-01"), null);
});

test("saved choices are read safely: unknown ids, bad dates, empty names and too many days are dropped", () => {
  assert.deepEqual(parseWheel(null), EMPTY_WHEEL);
  assert.deepEqual(parseWheel("not json"), EMPTY_WHEEL);
  const w = parseWheel({
    hidden: ["yule", "yule", "christmas"],
    names: { samhain: "  Hallows  ", mabon: "   ", nope: "x" },
    dates: { ostara: "03-21", litha: "13-01" },
    own: [
      { id: "own-a", name: "A", date: "01-02" },
      { id: "own-a", name: "Again", date: "01-03" },
      { id: "samhain", name: "Clash", date: "01-04" },
      { id: "own-b", name: "", date: "01-05" },
      { id: "own-c", name: "C", date: "1-5" },
    ],
  });
  assert.deepEqual(w.hidden, ["yule"]);
  assert.deepEqual(w.names, { samhain: "Hallows" });
  assert.deepEqual(w.dates, { ostara: "03-21" });
  assert.deepEqual(w.own, [{ id: "own-a", name: "A", date: "01-02" }]);
  const many = parseWheel({ own: Array.from({ length: 60 }, (_, i) => ({ id: `own-${i}`, name: `D${i}`, date: "05-05" })) });
  assert.equal(many.own.length, MAX_OWN_FESTIVALS);
  assert.deepEqual(parseWheel(JSON.stringify(w)), w, "what is saved reads back the same");
});

test("the reading shown for a day is the one opened most, then the earliest", () => {
  assert.equal(topReading([{ views: 1, at: "b" }, { views: 3, at: "c" }, { views: 3, at: "a" }])?.at, "a");
  assert.equal(topReading([]), null);
  const text = daySummaryText({ day: "2026-10-31", readings: 2, tools: ["Tarot"], top: { label: "Tarot", summary: "The Moon", href: "/readings/1", views: 4 }, snippet: "x", items: 0 }, [], "Full Moon");
  assert.match(text, /Opened most: Tarot, The Moon/);
});

test("every reading page's address is found again, and nothing else is", () => {
  for (const kind of DIVINATION_KINDS) {
    const path = divinationPath(kind, 42, 7);
    const found = readingFromPath(path);
    assert.ok(found, `${kind}: ${path}`);
    assert.equal(found.kind, kind);
    assert.equal(found.id, kind === "tarot" ? 7 : 42);
  }
  for (const p of ["/days/2026-10-01", "/readings", "/runes", "/oracle/42", "/forum/3", "/runes/0", "/runes/abc", "/settings/12"]) assert.equal(readingFromPath(p), null, p);
  assert.equal(readingFromPath("/runes/5?x=1")?.id, 5);
});

test("the calendar pieces that run in the browser import no database code", () => {
  for (const f of ["lib/calendar-core.ts", "components/days/WitchCalendar.tsx", "components/days/WheelEditor.tsx", "components/days/TodayOnHub.tsx", "components/ReadingViewCounter.tsx"]) {
    const imports = readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("import ") && !l.startsWith("import type"));
    assert.ok(!imports.some((l) => /lib\/(days|db|calendar)"|\/db"|pg"/.test(l)), `${f} imports no database code`);
  }
});

test("the Days page and today's page offer one New Reading button, not a row of tool pills", () => {
  for (const f of ["app/days/page.tsx", "components/DayView.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(src.includes("NewReadingMenu"), `${f} has the New Reading button`);
    assert.ok(!src.includes("DIVINATION_KIND_START"), `${f} lists no tools of its own`);
  }
});
