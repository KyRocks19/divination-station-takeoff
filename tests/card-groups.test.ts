import { test } from "node:test";
import assert from "node:assert/strict";
import { TAROT_DECK } from "../lib/cards";
import { groupNoteId, parseGroupNoteId } from "../lib/card-groups";
import { getCardStructure } from "../lib/card-structure";

test("every minor card's suit and number have an id that reads back to a name", () => {
  for (const card of TAROT_DECK) {
    const s = getCardStructure(card.id);
    assert.ok(s, card.id);
    if (s.kind === "major") continue;
    const suit = groupNoteId("suit", s.suit);
    const rank = groupNoteId("rank", s.rank);
    assert.ok(suit && rank, `${card.id} has no group ids`);
    assert.equal(parseGroupNoteId(suit)?.label, s.suitLabel);
    assert.equal(parseGroupNoteId(rank)?.label, s.rankPlural);
  }
});

test("only real suits and numbers have a note, and the major arcana has no suit note", () => {
  assert.equal(groupNoteId("suit", "cups"), "group-suit-cups");
  assert.equal(groupNoteId("rank", "5"), "group-rank-5");
  assert.equal(groupNoteId("suit", "major"), null);
  assert.equal(groupNoteId("suit", "coins"), null);
  assert.equal(groupNoteId("rank", "11"), null);
});

test("an id that is not a suit's or a number's is refused, and a card's id is never one", () => {
  for (const id of ["", "group-suit-", "group-suit-major", "group-rank-eleven", "group-other-cups", "cups-5", "group-suit-cups/../x", "GROUP-SUIT-CUPS"]) {
    assert.equal(parseGroupNoteId(id), null, id);
  }
  for (const card of TAROT_DECK) assert.equal(parseGroupNoteId(card.id), null, card.id);
});
