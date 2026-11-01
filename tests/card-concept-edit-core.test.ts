import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanCardMove, orientationOf, spotLabel } from "../lib/card-concept-edit-core";

const cards = new Set(["major-0", "major-16", "cups-ace", "swords-10"]);
const isCard = (id: string) => cards.has(id);

test("a move names known cards, an orientation each, and 1 to 200 concepts", () => {
  const ok = cleanCardMove({ ids: [3, 3, 7], from: { card: "major-16", orientation: "upright" }, to: { card: "cups-ace", orientation: "reversed" } }, isCard);
  assert.deepEqual(ok, { ok: true, move: { ids: [3, 7], from: { card: "major-16", orientation: "upright" }, to: { card: "cups-ace", orientation: "reversed" }, copy: false } });

  const copy = cleanCardMove({ ids: [1], from: { card: "major-0", orientation: "upright" }, to: { card: "major-0", orientation: "reversed" }, copy: true }, isCard);
  assert.equal(copy.ok && copy.move.copy, true, "moving between the orientations of one card is allowed");

  assert.equal(cleanCardMove({ ids: [], from: { card: "major-0", orientation: "upright" }, to: { card: "cups-ace", orientation: "upright" } }, isCard).ok, false);
  assert.equal(cleanCardMove({ ids: [1], from: { card: "major-99", orientation: "upright" }, to: { card: "cups-ace", orientation: "upright" } }, isCard).ok, false);
  assert.equal(cleanCardMove({ ids: [1], from: { card: "major-0", orientation: "sideways" }, to: { card: "cups-ace", orientation: "upright" } }, isCard).ok, false);
  assert.equal(cleanCardMove({ ids: [1], from: { card: "major-0", orientation: "upright" }, to: { card: "major-0", orientation: "upright" } }, isCard).ok, false);
  assert.equal(cleanCardMove({ ids: Array.from({ length: 201 }, (_, i) => i + 1), from: { card: "major-0", orientation: "upright" }, to: { card: "cups-ace", orientation: "upright" } }, isCard).ok, false);
  assert.equal(cleanCardMove(null, isCard).ok, false);
});

test("the words for a spot", () => {
  assert.equal(orientationOf(true), "reversed");
  assert.equal(orientationOf(false), "upright");
  assert.equal(spotLabel("The Tower", "reversed"), "The Tower, reversed");
});

test("the card route is for admins only and logs each change", () => {
  const route = readFileSync("app/api/archetypes/cards/route.ts", "utf8");
  assert.equal(route.match(/if \(!session\.isAdmin\) return Response\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/g)?.length, 2);
  assert.match(route, /logAdminAction\(session, "card_concepts_changed"/);
});
