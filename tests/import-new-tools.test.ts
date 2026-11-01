import test from "node:test";
import assert from "node:assert/strict";
import { cleanToolReading } from "../lib/import-tools-core";
import { cardOfMeaningId } from "../lib/playingcards-data";
import { meaningPiece } from "../lib/search-core";

const base = { created_at: "2026-10-19T10:00:00.000Z", summary: "x", journals: [], tags: [] };

test("playing cards import by name and refuse a name that is not in the pack", () => {
  const ok = cleanToolReading({ ...base, tool: "playingcards", cards: [{ card: "Seven of Hearts" }, { card: "ace of spades" }] });
  assert.deepEqual(ok?.detail, { kind: "playingcards", cards: [{ id: "H-7", name: "Seven of Hearts" }, { id: "S-A", name: "Ace of Spades" }] });
  assert.equal(cleanToolReading({ ...base, tool: "playingcards", cards: [{ card: "Seven of Hearts" }, { card: "Joker" }] }), null);
  assert.equal(cleanToolReading({ ...base, tool: "playingcards", cards: [] }), null);
});

test("charm landings import only inside the cloth and from one set", () => {
  const good = { set: "Pouch", charm: "Key", face: "down", across_0_to_1000: 10, down_0_to_1000: 990 };
  assert.equal(cleanToolReading({ ...base, tool: "charms", charms: [good] })?.detail.kind, "charms");
  assert.equal(cleanToolReading({ ...base, tool: "charms", charms: [{ ...good, across_0_to_1000: 1001 }] }), null);
  assert.equal(cleanToolReading({ ...base, tool: "charms", charms: [{ ...good, face: "sideways" }] }), null);
  assert.equal(cleanToolReading({ ...base, tool: "charms", charms: [good, { ...good, set: "Other" }] }), null);
});

test("a sign or dream needs a type, text and a real or empty day", () => {
  const n = { type: "dream", text: "a crow", happened_on: "2026-10-19" };
  assert.deepEqual(cleanToolReading({ ...base, tool: "signs", note: n })?.detail, { kind: "signs", type: "dream", body: "a crow", day: "2026-10-19" });
  assert.equal(cleanToolReading({ ...base, tool: "signs", note: { ...n, happened_on: null } })?.detail.kind, "signs");
  assert.equal(cleanToolReading({ ...base, tool: "signs", note: { ...n, happened_on: "2026-02-31" } }), null);
  assert.equal(cleanToolReading({ ...base, tool: "signs", note: { ...n, type: "omen" } }), null);
});

test("only a judged blind-target trial imports, and its numbers must be 1 to 4", () => {
  const t = { impression: "a ring", options: ["a", "b", "c", "d"], target_number: 3, your_choice_number: 3 };
  assert.equal(cleanToolReading({ ...base, tool: "remoteview", trial: t })?.detail.kind, "remoteview");
  assert.equal(cleanToolReading({ ...base, tool: "remoteview", trial: { in_progress: true, impression: "a ring" } }), null);
  assert.equal(cleanToolReading({ ...base, tool: "remoteview", trial: { ...t, target_number: 5 } }), null);
  assert.equal(cleanToolReading({ ...base, tool: "remoteview", trial: { ...t, options: ["a", "a", "c", "d"] } }), null);
});

test("the person's own words for a playing card are found by search under the card's name", () => {
  assert.equal(cardOfMeaningId("playing-H-7")?.id, "H-7");
  assert.deepEqual(meaningPiece("playing-H-7"), { label: "Seven of Hearts", note: "Playing cards", href: "/playingcards/set/H-7" });
  assert.equal(meaningPiece("playing-Z-9"), null);
});
