import test from "node:test";
import assert from "node:assert/strict";
import { journalSnapshot, readSnapshot, synthesisSnapshot } from "../lib/forum-snapshots";

test("a journal snapshot keeps what the post shows and nothing else of the row", () => {
  const snap = journalSnapshot(
    { author: "user", content: "My words", card_index: 2, clarifier_index: null, created_at: new Date("2026-10-01T10:00:00Z"), ...({ id: 9, reading_id: 4, secret: "x" } as object) } as never,
    { id: 4, title: "Monday", spread_name: "Three card", ...({ user_id: 1 } as object) } as never
  );
  const v = JSON.parse(snap);
  assert.deepEqual(Object.keys(v).sort(), ["author", "card_index", "clarifier_index", "content", "created_at", "reading"]);
  assert.equal(v.content, "My words");
  assert.equal(v.created_at, "2026-10-01T10:00:00.000Z");
  assert.deepEqual(v.reading, { id: 4, title: "Monday", spread_name: "Three card" });
});

test("a journal snapshot without a reading is allowed", () => {
  assert.equal(JSON.parse(journalSnapshot({ author: "user", content: "c", created_at: "2026-10-01" }, null)).reading, null);
});

test("a synthesis snapshot keeps the prompt and the text, not the ids of the readings behind it", () => {
  const v = JSON.parse(synthesisSnapshot({ prompt: "p", content: "c", created_at: "2026-10-01", ...({ context_ids: "[1,2]" } as object) } as never));
  assert.deepEqual(Object.keys(v).sort(), ["content", "created_at", "prompt"]);
});

test("readSnapshot returns null for an older post, empty text and anything unreadable", () => {
  assert.equal(readSnapshot(null), null);
  assert.equal(readSnapshot(""), null);
  assert.equal(readSnapshot("not json"), null);
  assert.equal(readSnapshot("[1,2]"), null);
  assert.deepEqual(readSnapshot('{"a":1}'), { a: 1 });
});
