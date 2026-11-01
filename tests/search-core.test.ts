import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  MAX_QUERY,
  PER_GROUP,
  cleanQuery,
  cleanToday,
  dayFromQuery,
  dayFromWords,
  escapeLike,
  likePatterns,
  meaningPiece,
  normalize,
  orderGroups,
  rankEntries,
  scoreText,
  searchStatic,
  snippetAround,
  staticEntries,
  stripMarkdown,
} from "../lib/search-core";
import { SEARCH_OPTIONS, cleanOptions, countItems } from "../lib/search-shared";
import { ARCHETYPES } from "../lib/archetypes-data";
import { RUNES } from "../lib/runes-data";
import { STAVES } from "../lib/ogham-data";
import { TAROT_DECK } from "../lib/cards";

test("a query is trimmed, its spaces made one, and cut to the longest allowed", () => {
  assert.equal(cleanQuery("  the   moon \n"), "the moon");
  assert.equal(cleanQuery(undefined), "");
  assert.equal(cleanQuery(42), "");
  assert.equal(cleanQuery("x".repeat(500)).length, MAX_QUERY);
});

test("matching ignores case, accents and punctuation", () => {
  assert.equal(normalize("Hékate's  Wheel"), "hekate s wheel");
  assert.equal(scoreText("Hékate", "hekate"), 4);
  assert.equal(scoreText("Ace of Cups", "ACE"), 3);
});

test("a whole name beats its start, which beats a word in it, which beats the inside of a word", () => {
  const whole = scoreText("Moon", "moon")!;
  const start = scoreText("Moonlight", "moon")!;
  const word = scoreText("The Moon", "moon")!;
  const inside = scoreText("Honeymoon", "moon")!;
  const scattered = scoreText("Ace of Cups", "ace cups")!;
  assert.ok(whole > start && start > word && word > inside && inside > scattered, `${whole} ${start} ${word} ${inside} ${scattered}`);
  assert.equal(scoreText("The Sun", "moon"), null);
  assert.equal(scoreText("Ace of Cups", "ace wands"), null, "every word must be found");
});

test("ranking keeps the best first and says when more matched than are shown", () => {
  const entries = ["Honeymoon", "The Moon", "Moon", "Moonlight", "Blue moon", "Moonstone", "Half moon"].map((label, i) => ({
    id: String(i),
    label,
    href: `/${i}`,
  }));
  const { items, more } = rankEntries(entries, "moon");
  assert.equal(items.length, PER_GROUP);
  assert.equal(more, true);
  assert.deepEqual(
    items.map((i) => i.label),
    ["Moon", "Moonlight", "Moonstone", "The Moon", "Blue moon"],
    "ties keep the order they came in"
  );
});

test("a keyword finds a page, ranked below any page whose name matches", () => {
  const pages = searchStatic("font", false).find((g) => g.id === "pages");
  assert.ok(pages?.items.some((i) => i.href === "/settings"), "font finds Settings (Reading comfort)");
  const { items } = rankEntries(
    [
      { id: "a", label: "Settings", href: "/settings", keywords: ["journals"] },
      { id: "b", label: "Journals", href: "/journals" },
    ],
    "journals"
  );
  assert.deepEqual(items.map((i) => i.id), ["b", "a"]);
});

test("the shared things in code: every card, rune, stave and archetype is there with its own page", () => {
  const all = staticEntries();
  assert.equal(all.cards.length, TAROT_DECK.length);
  assert.equal(all.runes.length, RUNES.length);
  assert.equal(all.staves.length, STAVES.length);
  assert.equal(all.archetypes.length, ARCHETYPES.length);
  assert.ok(all.cards.every((c) => c.href.startsWith("/cards/")));
  assert.ok(all.runes.every((r) => r.href === `/runes/set/${r.id}`));
  assert.ok(all.staves.every((s) => s.href === `/ogham/set/${s.id}`));
  assert.ok(all.archetypes.every((a) => a.href.startsWith("/archetypes/")));
  const ids = Object.values(all).flat().map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "every id is unique, so the window can use it");
});

test("a shared thing is found by its name only, never by a stock meaning", () => {
  // "New beginnings" is the Fool's stock upright meaning; it must not find the card.
  const groups = searchStatic("new beginnings", false);
  assert.equal(groups.find((g) => g.id === "cards"), undefined);
  const fool = searchStatic("fool", false).find((g) => g.id === "cards");
  assert.equal(fool?.items[0].label, "The Fool");
  assert.ok(!fool?.items[0].note?.toLowerCase().includes("beginning"));
});

test("searching finds a card, a rune and an archetype by a few letters", () => {
  assert.equal(searchStatic("moon", false).find((g) => g.id === "cards")?.items[0].label, "The Moon");
  assert.equal(searchStatic("fehu", false).find((g) => g.id === "runes")?.items[0].label, RUNES.find((r) => r.id === "rune-fehu")?.name);
  const ace = searchStatic("ace cups", false).find((g) => g.id === "cards");
  assert.equal(ace?.items[0].label, "Ace of Cups");
  const someArchetype = ARCHETYPES[0];
  assert.ok(searchStatic(someArchetype.name, false).find((g) => g.id === "archetypes")?.items.some((i) => i.label === someArchetype.name));
});

test("one letter finds nothing", () => {
  assert.deepEqual(searchStatic("m", false), []);
  assert.deepEqual(searchStatic("  ", false), []);
});

test("administrator pages are found only by administrators", () => {
  const forPerson = searchStatic("users", false).find((g) => g.id === "pages");
  const forAdmin = searchStatic("users", true).find((g) => g.id === "pages");
  assert.ok(!forPerson?.items.some((i) => i.href === "/admin/users"));
  assert.ok(forAdmin?.items.some((i) => i.href === "/admin/users"));
});

test("groups come out in the fixed order, empty ones dropped, and are counted", () => {
  const groups = orderGroups([
    { id: "days", label: "Your days", items: [{ id: "d", label: "x", href: "/" }], more: false },
    { id: "pages", label: "Pages", items: [{ id: "p", label: "x", href: "/" }], more: false },
    { id: "cards", label: "Tarot cards", items: [], more: false },
  ]);
  assert.deepEqual(groups.map((g) => g.id), ["pages", "days"]);
  assert.equal(countItems(groups), 2);
  assert.equal(new Set(GROUP_ORDER).size, GROUP_ORDER.length);
});

test("the words around a match: the text's own words, cut on whole words", () => {
  const text = "I walked down to the river at night and the moon was so bright that the whole field turned silver and quiet.";
  const s = snippetAround(text, "MOON", 20)!;
  assert.equal(s[1], "moon");
  assert.ok(s[0].startsWith("...") && s[2].endsWith("..."));
  const before = s[0].slice(3);
  const after = s[2].slice(0, -3);
  const at = text.indexOf(before + s[1] + after);
  assert.ok(at > 0, "the words shown are the text's own, in order");
  assert.equal(text[at - 1], " ", "begins on a whole word");
  assert.equal(text[at + (before + s[1] + after).length], " ", "ends on a whole word");
  assert.equal(snippetAround(text, "sun"), null);
});

test("the match is found through accents, and shown with them", () => {
  const s = snippetAround("A prayer to Hékate at the crossroads.", "hekate")!;
  assert.equal(s[1], "Hékate");
  assert.equal(s[0], "A prayer to ");
  assert.equal(s[2], " at the crossroads.");
});

test("a short text is shown whole, with no dots", () => {
  assert.deepEqual(snippetAround("Moon again", "moon"), ["", "Moon", " again"]);
});

test("markdown marks are taken out of a day page's words", () => {
  assert.equal(stripMarkdown("# Today\n- **bright** moon, see [notes](/x) and `code`"), "Today\nbright moon, see notes and code");
});

test("LIKE patterns: one per word, with the pattern characters escaped", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
  assert.deepEqual(likePatterns("  full   moon "), ["%full%", "%moon%"]);
  assert.deepEqual(likePatterns("100%"), ["%100\\%%"]);
});

test("a date typed in full asks for that day's page; anything else does not", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.equal(dayFromQuery("2026-10-03", now), "2026-10-03");
  assert.equal(dayFromQuery(" 2026-10-03 ", now), "2026-10-03");
  assert.equal(dayFromQuery("2026-02-30", now), null);
  assert.equal(dayFromQuery("2031-01-01", now), null, "not far in the future");
  assert.equal(dayFromQuery("october", now), null);
});

test("every kind of piece the person can write a meaning for has a name and a page", () => {
  assert.deepEqual(meaningPiece("major-0"), { label: "The Fool", note: "Tarot · Major arcana", href: "/cards/major-0" });
  assert.equal(meaningPiece(RUNES[0].id)?.href, `/runes/set/${RUNES[0].id}`);
  assert.equal(meaningPiece(STAVES[0].id)?.href, `/ogham/set/${STAVES[0].id}`);
  assert.deepEqual(meaningPiece("die-d6-3"), { label: "d6 · 3", note: "Dice", href: "/dice/set/d6/3" });
  assert.deepEqual(meaningPiece("coin-heads"), { label: "Coin · Heads", note: "Coin", href: "/dice/set/coin/heads" });
});

test("a whole suit or number opens the first card of it, and an id the app does not have is dropped", () => {
  const suit = meaningPiece("group-suit-cups");
  assert.equal(suit?.label, "Cups");
  assert.match(suit!.href, /^\/cards\/cups-/);
  const rank = meaningPiece("group-rank-5");
  assert.equal(rank?.label, "Fives");
  assert.match(rank!.href, /^\/cards\/(cups|wands|swords|pentacles)-5$/);
  assert.equal(meaningPiece("group-suit-nothing"), null);
  assert.equal(meaningPiece("die-d6-9"), null);
  assert.equal(meaningPiece("not-a-piece"), null);
});

test("the new groups are in the fixed order, after the person's readings and before their days", () => {
  const order = GROUP_ORDER;
  assert.ok(order.indexOf("meanings") < order.indexOf("readings"));
  assert.ok(order.indexOf("journals") < order.indexOf("predictions"));
  assert.ok(order.indexOf("predictions") < order.indexOf("yours"));
  assert.ok(order.indexOf("yours") < order.indexOf("days"));
  assert.ok(order.indexOf("yours") < order.indexOf("cloths") && order.indexOf("cloths") < order.indexOf("days"), "the cloths group follows the person's archetypes");
  assert.deepEqual(order.slice(-2), ["forum", "comments"], "other people's writing is last: posts, then their comments");
  assert.ok(order.indexOf("days") < order.indexOf("earlier") && order.indexOf("earlier") < order.indexOf("forum"), "earlier versions of the person's own wording come before the forum");
  for (const id of order) assert.ok(GROUP_LABELS[id], `${id} has a label`);
});

test("the extra places of the search are chosen from a fixed list and are off by default", () => {
  assert.deepEqual(SEARCH_OPTIONS.map((o) => o.id), ["earlier", "comments"]);
  assert.deepEqual(cleanOptions(undefined), []);
  assert.deepEqual(cleanOptions("comments"), []);
  assert.deepEqual(cleanOptions(["comments", "earlier", "comments", "everything", 3, null]), ["earlier", "comments"]);
  for (const o of SEARCH_OPTIONS) assert.ok(GROUP_LABELS[o.id], `${o.id} names a group`);
});

// 2026-10-17 is a Saturday.
const TODAY = "2026-10-17";

test("dates in words: today, yesterday, days and weeks ago", () => {
  assert.equal(dayFromWords("today", TODAY), "2026-10-17");
  assert.equal(dayFromWords("Yesterday", TODAY), "2026-10-16");
  assert.equal(dayFromWords("tomorrow", TODAY), "2026-10-18");
  assert.equal(dayFromWords("3 days ago", TODAY), "2026-10-14");
  assert.equal(dayFromWords("1 day ago", TODAY), "2026-10-16");
  assert.equal(dayFromWords("a week ago", TODAY), "2026-10-10");
  assert.equal(dayFromWords("2 weeks ago", TODAY), "2026-10-03");
});

test("dates in words: a weekday is the latest one, and 'last' never means today", () => {
  assert.equal(dayFromWords("saturday", TODAY), "2026-10-17");
  assert.equal(dayFromWords("last saturday", TODAY), "2026-10-10");
  assert.equal(dayFromWords("monday", TODAY), "2026-10-12");
  assert.equal(dayFromWords("last monday", TODAY), "2026-10-12");
  assert.equal(dayFromWords("Friday", TODAY), "2026-10-16");
  assert.equal(dayFromWords("sunday", TODAY), "2026-10-11");
});

test("dates in words: a day and a month, either way round, with or without a year", () => {
  assert.equal(dayFromWords("3 october", TODAY), "2026-10-03");
  assert.equal(dayFromWords("October 3rd", TODAY), "2026-10-03");
  assert.equal(dayFromWords("the 3rd of October", TODAY), "2026-10-03");
  assert.equal(dayFromWords("3 oct", TODAY), "2026-10-03");
  assert.equal(dayFromWords("5 sept", TODAY), "2026-09-05");
  assert.equal(dayFromWords("may 5", TODAY), "2026-05-05");
  assert.equal(dayFromWords("oct 3 2025", TODAY), "2025-10-03");
  assert.equal(dayFromWords("3 October 2025", TODAY), "2025-10-03");
});

test("dates in words: a date that has not come yet this year means last year's", () => {
  assert.equal(dayFromWords("25 december", TODAY), "2025-12-25");
  assert.equal(dayFromWords("18 october", TODAY), "2025-10-18");
  assert.equal(dayFromWords("17 october", TODAY), "2026-10-17", "today itself is this year");
  assert.equal(dayFromWords("29 february", TODAY), "2024-02-29", "the last year that had one");
});

test("dates in words: anything that is not a date finds nothing", () => {
  for (const q of ["october", "march", "moon", "monday morning", "31 april", "30 february", "3 octobre", "2 3", "mon", "0 october", "3 october 2031", "3 october 1999", "40 days"]) {
    assert.equal(dayFromWords(q, TODAY), null, q);
  }
  assert.equal(dayFromWords("yesterday", "not a day"), null, "no usable day, no answer");
});

test("the device's day is trusted only within a day of the server's", () => {
  const now = new Date("2026-10-17T23:30:00Z");
  assert.equal(cleanToday("2026-10-18", now), "2026-10-18", "a place already past midnight");
  assert.equal(cleanToday("2026-10-16", now), "2026-10-16");
  assert.equal(cleanToday("2026-10-25", now), "2026-10-17", "too far: the UTC day");
  assert.equal(cleanToday("yesterday", now), "2026-10-17");
  assert.equal(cleanToday(undefined, now), "2026-10-17");
});

test("with accent folding the words lose their accents, so the database can match them against unaccented text", () => {
  assert.deepEqual(likePatterns("Hékate café", true), ["%Hekate%", "%cafe%"]);
  assert.deepEqual(likePatterns("Hékate café"), ["%Hékate%", "%café%"], "without folding the words are as typed");
  assert.deepEqual(likePatterns("100% señor", true), ["%100\\%%", "%senor%"], "the pattern characters are still escaped");
});

test("the unaccent migration only adds the extension, and the search falls back when it is missing", () => {
  const sql = readFileSync(new URL("../migrations/072_unaccent.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS unaccent;/);
  assert.doesNotMatch(sql, /\b(DROP|ALTER TABLE|CREATE TABLE)\b/i);
  const search = readFileSync(new URL("../lib/search.ts", import.meta.url), "utf8");
  assert.match(search, /FROM pg_extension WHERE extname = 'unaccent'/, "it looks for the extension instead of assuming it");
  // Every pattern match goes through like(), which folds accents when it can: no other line spells out ILIKE ALL.
  const spelledOut = search.split(/\r?\n/).filter((l) => l.includes("ILIKE ALL") && !/^\s*(\/\/|\*|\/\*)/.test(l) && !l.includes("return `"));
  assert.deepEqual(spelledOut, []);
});
