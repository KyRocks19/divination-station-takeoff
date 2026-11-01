import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TAROT_DECK } from "../lib/cards";
import { cardIdToFileName } from "../lib/card-image";

test("every card of the deck has a picture file", () => {
  for (const card of TAROT_DECK) {
    const file = cardIdToFileName(card.id);
    assert.ok(existsSync(join(process.cwd(), "public", "cards", file)), `${card.id} -> ${file}`);
  }
});

test("a few ids map to the names the pictures have", () => {
  assert.equal(cardIdToFileName("major-0"), "0-Fool.jpg");
  assert.equal(cardIdToFileName("cups-ace"), "Ace-Cups.jpg");
  assert.equal(cardIdToFileName("swords-10"), "X-Swords.jpg");
  assert.equal(cardIdToFileName("pentacles-queen"), "Queen-Pentacles.jpg");
});
