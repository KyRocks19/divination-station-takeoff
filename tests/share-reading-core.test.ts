// Checks on the Markdown made for sharing one reading. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTHING_EXTRA, readingToMarkdown, toolReadingToMarkdown, type ShareReading, type ShareToolReading } from "../lib/share-reading-core";

const reading: ShareReading = {
  title: "A question about the move",
  spread_name: "Three Card Spread",
  question: "Should I take the flat?\nIt is cheap.",
  created_at: "2026-10-12T09:30:00Z",
  notes: "# My heading\nI felt calm.",
  cards: [
    { position: "Past", card_name: "The Tower", reversed: false },
    { position: "Present", card_name: "Five of Cups", reversed: true },
    { position: "Future", card_name: "The Star", reversed: false },
  ],
  clarifiers: { 1: [{ card_name: "Two of Wands", reversed: false, position: "" }] },
};
const entries = [
  { id: 1, label: "You", content: "First note.\n\n## Part two\nMore." },
  { id: 2, label: "Hiero", content: "A private reflection." },
];

test("by default only the title, the spread and the cards are in the text", () => {
  const md = readingToMarkdown(reading, entries, NOTHING_EXTRA);
  assert.match(md, /^# A question about the move\n/);
  assert.ok(md.includes("_Three Card Spread_"));
  assert.ok(md.includes("1. **Past**: The Tower (upright)"));
  assert.ok(md.includes("2. **Present**: Five of Cups (reversed)"));
  assert.ok(md.includes("   - clarifier: Two of Wands (upright)"));
  for (const left of ["Should I take", "I felt calm", "First note", "private reflection", "October"]) {
    assert.ok(!md.includes(left), `"${left}" must not be in the text unless it was ticked`);
  }
});

test("each part appears only when ticked, and only the ticked entries", () => {
  const md = readingToMarkdown(reading, entries, { question: true, date: true, notes: true, entryIds: [1] }, "en-US");
  assert.ok(md.includes("**Question:** Should I take the flat? It is cheap."), "the question is one line");
  assert.ok(md.includes("October 12, 2026"));
  assert.ok(md.includes("I felt calm."));
  assert.ok(md.includes("First note."));
  assert.ok(!md.includes("private reflection"), "an entry that was not ticked stays out");
});

test("the person's own headings are shifted below the post's headings", () => {
  const md = readingToMarkdown(reading, entries, { ...NOTHING_EXTRA, notes: true, entryIds: [1] });
  assert.ok(md.includes("\n## My heading\n"), "# in the notes becomes ##");
  assert.ok(md.includes("\n### Part two\n"), "## in an entry becomes ###");
  assert.equal(md.split("\n").filter((l) => /^# /.test(l)).length, 1, "only one top heading");
});

test("a reading with no title uses the spread name, and an empty entry is left out", () => {
  const md = readingToMarkdown({ ...reading, title: " ", cards: [] }, [{ id: 3, label: "You", content: "  " }], { ...NOTHING_EXTRA, entryIds: [3] });
  assert.match(md, /^# Three Card Spread\n/);
  assert.ok(!md.includes("## Journal"));
});

test("it is pure text: no network, database or browser calls", () => {
  const src = readFileSync("lib/share-reading-core.ts", "utf8");
  assert.ok(!/\bfetch\s*\(|from\s+["']\.\/db["']|XMLHttpRequest|navigator\./.test(src));
});

// ── A reading with any other tool ────────────────────────────────────────────────────────────────────

const runesReading: ShareToolReading = {
  tool: "Runes",
  question: "What\nnow?",
  created_at: "2026-10-12T09:30:00Z",
  lines: ["Past: Fehu", "Present: Uruz (upside down)"],
};

test("another tool's reading starts with what came up and nothing private", () => {
  const md = toolReadingToMarkdown(runesReading, entries, NOTHING_EXTRA);
  assert.match(md, /^# Runes\n/);
  assert.ok(md.includes("## What came up"));
  assert.ok(md.includes("1. Past: Fehu"));
  assert.ok(md.includes("2. Present: Uruz (upside down)"));
  assert.ok(!md.includes("What now"), "the question is off until ticked");
  assert.ok(!md.includes("2026"), "the date is off until ticked");
  assert.ok(!md.includes("First note"), "no journal entry is in it until ticked");
});

test("the question, the date and a ticked entry are added on request, and an entry that was not ticked never is", () => {
  const md = toolReadingToMarkdown(runesReading, entries, { question: true, date: true, notes: false, entryIds: [1] }, "en-US");
  assert.ok(md.includes("**Question:** What now?"));
  assert.ok(md.includes("_October 12, 2026_"));
  assert.ok(md.includes("**You**"));
  assert.ok(md.includes("### Part two"), "a heading in the person's own writing is shifted down");
  assert.ok(!md.includes("A private reflection."));
});
