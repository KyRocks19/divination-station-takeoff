import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTE_WORD_MAX, NOTE_WORD_MIN_NOTES, recurringNoteWords, wordsOf } from "../lib/note-words-core";

const note = (id: number, body: string, day = id) => ({ divination_id: id, body, created_at: `2026-10-${String(day).padStart(2, "0")}T08:00:00.000Z` });

test("a note's words are lower case, three letters or more, without common words, each once", () => {
  assert.deepEqual([...wordsOf("I dreamt of the Owl, the owl's eyes, and a red door. It was a door!")].sort(), ["door", "eyes", "owl", "red"]);
  assert.deepEqual([...wordsOf("Éabhadh and café")].sort(), ["café", "éabhadh"]);
});

test("a word shows once it is in three notes, counted once a note, latest notes listed", () => {
  const words = recurringNoteWords([note(1, "a crow, a crow, a crow"), note(2, "the crow again"), note(3, "a fox"), note(4, "crow and fox")]);
  assert.equal(NOTE_WORD_MIN_NOTES, 3);
  assert.deepEqual(words.map((w) => [w.word, w.count]), [["crow", 3]]);
  assert.deepEqual(words[0].entries.map((e) => e.id), [1, 2, 4]);
  assert.equal(words[0].earlier, 0);
});

test("the list is ordered by how many notes, then the most recent, and is capped", () => {
  const notes = [note(1, "river moon"), note(2, "river moon"), note(3, "river moon key"), note(4, "river key"), note(5, "key")];
  assert.deepEqual(recurringNoteWords(notes).map((w) => w.word), ["river", "key", "moon"]);
  const many = Array.from({ length: 3 }, (_, i) => note(i + 1, Array.from({ length: NOTE_WORD_MAX + 5 }, (_, j) => `word${"abcdefghijklmnopqrstuvwxyz"[j]}`).join(" ")));
  assert.equal(recurringNoteWords(many).length, NOTE_WORD_MAX);
});

test("the core imports nothing but a type, and the query reads only the person's own notes", () => {
  const core = readFileSync(new URL("../lib/note-words-core.ts", import.meta.url), "utf8");
  assert.deepEqual([...core.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]), ["./divination-kinds"]);
  assert.match(core, /^import type /m);
  assert.match(readFileSync(new URL("../lib/patterns.ts", import.meta.url), "utf8"), /FROM sign_notes n JOIN divinations d ON d\.id = n\.divination_id WHERE n\.user_id = \$1 AND d\.user_id = \$1/);
});
