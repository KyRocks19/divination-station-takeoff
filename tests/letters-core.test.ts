import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  cleanQuestion,
  cleanWriteBackOn,
  letterExportMarkdown,
  letterFor,
  noticesFrom,
  parseAction,
  parseRecipient,
  readingLine,
  shapeLetterExport,
  stageOf,
  type LetterRow,
} from "../lib/letters-core";

// Rowan (1) asks; Sam (2) reads; Ash (3) is someone else in the circle.
const row = (over: Partial<LetterRow> = {}): LetterRow => ({
  id: 7,
  circle_id: 4,
  asker_id: 1,
  asker_name: "Rowan",
  to_user_id: null,
  to_name: null,
  to_circle: true,
  question: "Should I take the new job?",
  blind: false,
  created_at: "2026-10-01T10:00:00Z",
  declined_at: null,
  reader_id: null,
  reader_name: null,
  taken_at: null,
  divination_id: null,
  divination_kind: null,
  divination_reading_id: null,
  reading_line: null,
  letter: null,
  sealed_at: null,
  opened_at: null,
  write_back_on: null,
  reply: null,
  replied_at: null,
  reply_seen_at: null,
  reader_hidden_at: null,
  ...over,
});

const sealed = (over: Partial<LetterRow> = {}) =>
  row({
    reader_id: 2,
    reader_name: "Sam",
    taken_at: "2026-10-02T10:00:00Z",
    divination_id: 30,
    divination_kind: "runes",
    reading_line: "Norse runes: Raidho",
    letter: "Raidho came up: a journey.",
    sealed_at: "2026-10-02T11:00:00Z",
    ...over,
  });

test("the stage follows the furthest step taken", () => {
  assert.equal(stageOf(row()), "waiting");
  assert.equal(stageOf(row({ declined_at: "x" })), "declined");
  assert.equal(stageOf(row({ reader_id: 2 })), "reading");
  assert.equal(stageOf(sealed()), "sealed");
  assert.equal(stageOf(sealed({ opened_at: "x" })), "opened");
  assert.equal(stageOf(sealed({ opened_at: "x", replied_at: "y" })), "replied");
});

test("someone who is not the asker, the reader, or offered it sees nothing", () => {
  assert.equal(letterFor(row(), 3), null);
  assert.equal(letterFor(sealed(), 3), null);
  // Once someone has picked it up, it is no longer offered to anyone else, even if the database said so.
  assert.equal(letterFor(row({ reader_id: 2 }), 3, true), null);
  assert.equal(letterFor(row({ declined_at: "x" }), 3, true), null);
});

test("a blind letter hides the question from the reader until they seal theirs, never from the asker", () => {
  const blind = row({ blind: true });
  assert.equal(letterFor(blind, 3, true)!.question, null);
  assert.equal(letterFor(row({ blind: true, reader_id: 2, reader_name: "Sam" }), 2)!.question, null);
  assert.equal(letterFor(sealed({ blind: true }), 2)!.question, "Should I take the new job?");
  assert.equal(letterFor(blind, 1)!.question, "Should I take the new job?");
  // An open letter shows the question to whoever is offered it.
  assert.equal(letterFor(row(), 3, true)!.question, "Should I take the new job?");
});

test("the asker sees the letter only after opening it; the reader always sees what they sent", () => {
  const unopened = letterFor(sealed(), 1)!;
  assert.equal(unopened.letter, null);
  assert.equal(unopened.reading_line, null);
  assert.equal(unopened.stage, "sealed");
  const opened = letterFor(sealed({ opened_at: "2026-10-03T10:00:00Z" }), 1)!;
  assert.equal(opened.letter, "Raidho came up: a journey.");
  assert.equal(opened.reading_line, "Norse runes: Raidho");
  assert.equal(letterFor(sealed(), 2)!.letter, "Raidho came up: a journey.");
});

test("only the reader gets the link to their reading, and only the asker their reminder day", () => {
  const l = sealed({ opened_at: "x", write_back_on: "2026-11-01" });
  assert.equal(letterFor(l, 2)!.reading_href, "/runes/30");
  assert.equal(letterFor(l, 1)!.reading_href, null);
  assert.equal(letterFor(l, 1)!.write_back_on, "2026-11-01");
  assert.equal(letterFor(l, 2)!.write_back_on, null);
});

test("a reader who removed a sealed letter from their list no longer sees it; the asker still does", () => {
  const l = sealed({ reader_hidden_at: "x" });
  assert.equal(letterFor(l, 2), null);
  assert.ok(letterFor(l, 1));
});

test("a reply is new for the reader until they have seen it", () => {
  assert.equal(letterFor(sealed({ opened_at: "x", reply: "I took it.", replied_at: "y" }), 2)!.reply_new, true);
  assert.equal(letterFor(sealed({ opened_at: "x", reply: "I took it.", replied_at: "y", reply_seen_at: "z" }), 2)!.reply_new, false);
  assert.equal(letterFor(sealed({ opened_at: "x", reply: "I took it.", replied_at: "y" }), 1)!.reply_new, false);
});

test("notices: asked of you, arrived, the write-back day, a reply", () => {
  const views = [
    letterFor(row({ id: 1, to_circle: false, to_user_id: 2 }), 2, true)!,
    letterFor(row({ id: 2 }), 2, true)!, // asked of the circle: no notice, it is on the Letters page
    letterFor(sealed({ id: 3, asker_id: 2, asker_name: "Sam", reader_id: 5, reader_name: "Ash" }), 2)!,
    letterFor(sealed({ id: 4, asker_id: 2, asker_name: "Sam", reader_id: 5, reader_name: "Ash", opened_at: "x", write_back_on: "2026-10-30" }), 2)!,
    letterFor(sealed({ id: 5, asker_id: 2, asker_name: "Sam", reader_id: 5, reader_name: "Ash", opened_at: "x", write_back_on: "2026-11-30" }), 2)!,
    letterFor(sealed({ id: 6, opened_at: "x", reply: "It went well.", replied_at: "y" }), 2)!,
  ];
  assert.deepEqual(
    noticesFrom(views, "2026-10-30").map((n) => [n.kind, n.id, n.name]),
    [
      ["asked_of_you", 1, "Rowan"],
      ["arrived", 3, "Ash"],
      ["write_back", 4, "Ash"],
      ["reply", 6, "Rowan"],
    ]
  );
});

test("input checks", () => {
  assert.equal(cleanQuestion("  ").ok, false);
  assert.equal(cleanQuestion("x".repeat(1001)).ok, false);
  assert.deepEqual(cleanQuestion("  What now? "), { ok: true, text: "What now?" });
  assert.equal(cleanWriteBackOn(""), null);
  assert.equal(cleanWriteBackOn("2026-11-31"), undefined);
  assert.equal(cleanWriteBackOn("2026-11-30"), "2026-11-30");
  assert.deepEqual(parseRecipient("circle"), { to: "circle" });
  assert.deepEqual(parseRecipient(5), { to: "member", id: 5 });
  assert.equal(parseRecipient(-1), null);
  assert.equal(parseRecipient("anyone"), null);
  assert.equal(parseAction("seal"), "seal");
  assert.equal(parseAction("grade"), null);
  assert.equal(readingLine("Tarot", "The Tower,  Three of Cups", null), "Tarot: The Tower, Three of Cups");
  assert.equal(readingLine("Pendulum", "", null), "Pendulum");
});

test("the export holds only this person's own words", () => {
  const rows = [
    sealed({ id: 1, opened_at: "x", reply: "I took the job.", replied_at: "2026-10-20T10:00:00Z" }),
    sealed({ id: 2, asker_id: 2, asker_name: "Sam", reader_id: 1, reader_name: "Rowan", question: "Sam's private question", letter: "Rowan's letter" }),
  ];
  const asRowan = shapeLetterExport(rows, 1);
  const text = JSON.stringify(asRowan) + letterExportMarkdown(asRowan).join("\n");
  assert.ok(text.includes("Should I take the new job?"));
  assert.ok(text.includes("I took the job."));
  assert.ok(text.includes("Rowan's letter"));
  assert.ok(!text.includes("Raidho came up"), "Sam's letter to Rowan is Sam's words");
  assert.ok(!text.includes("Sam's private question"), "Sam's question is Sam's words");
  assert.deepEqual(letterExportMarkdown({ letters: [] }), []);
});

test("letters are hidden on a copy for one person, and the AI companion never reads them", () => {
  const features = readFileSync("lib/edition-features.ts", "utf8");
  assert.ok(features.includes('"/letters"') && features.includes('"/api/letters"'));
  // Every file the companion, the interviewer and the guide build their context from.
  const files = readdirSync("lib").filter((f) => /^(companion|interview|guide)/.test(f));
  assert.ok(files.length > 5);
  for (const f of files) assert.ok(!/(FROM|JOIN) letters\b|lib\/letters|letters-core/.test(readFileSync(`lib/${f}`, "utf8")), `lib/${f} must not read letters`);
});
