import { test } from "node:test";
import assert from "node:assert/strict";
import { TAROT_DECK } from "../lib/cards";
import { RUNES } from "../lib/runes-data";
import { STAVES } from "../lib/ogham-data";
import { oracleItemHref, symbolLabel } from "../lib/piece-labels";
import { isKnownSymbolId } from "../lib/symbol-ids";

test("every piece the app can link has a name and a page", () => {
  const ids = [
    ...TAROT_DECK.map((c) => c.id), ...RUNES.map((r) => r.id), ...STAVES.map((s) => s.id),
    "die-d6-3", "die-d100-57", "coin-heads", "coin-tails", "swing-line-0", "swing-circle_cw", "swing-still", "swing-line-45",
    "scrying-mirror", "scrying-ball", "scrying-water",
  ];
  for (const id of ids) {
    assert.ok(isKnownSymbolId(id), id);
    const label = symbolLabel(id);
    assert.ok(label && label.name && label.href.startsWith("/"), `${id} has no label`);
  }
});

test("labels read as people expect", () => {
  assert.deepEqual(symbolLabel("major-0"), { name: "The Fool", href: "/cards/major-0" });
  assert.deepEqual(symbolLabel("rune-fehu"), { name: "Fehu (rune)", href: "/runes/set/rune-fehu" });
  assert.deepEqual(symbolLabel("ogham-oir"), { name: "Óir (ogham)", href: "/ogham/set/ogham-oir" });
  assert.deepEqual(symbolLabel("die-d6-3"), { name: "Dice: d6 · 3", href: "/dice/set/d6/3" });
  assert.deepEqual(symbolLabel("coin-heads"), { name: "Dice: Coin · Heads", href: "/dice/set/coin/heads" });
  assert.deepEqual(symbolLabel("swing-line-45"), { name: "Pendulum: line at 45°", href: "/pendulum/swings" });
  assert.equal(oracleItemHref(12), "/oracle/cards/12");
});

test("an id that is not a piece has no label", () => {
  for (const id of ["rune-nope", "die-d6-9", "swing-line-x", "scrying-tea", ""]) assert.equal(symbolLabel(id), null, id);
});
