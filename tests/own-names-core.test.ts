// Checks on the knucklebone's shape words and the person's own names for pieces (open item T17). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { facesOf, getFace, sideShape, DICE_HISTORY } from "../lib/dice-data";
import { MAX_OWN_NAME, canNamePiece, cleanOwnName, namesById, withOwnName } from "../lib/own-names-core";
import { shapeOwnExport, ownMarkdown } from "../lib/export-own-core";
import { CITES, getSource } from "../lib/sources";

test("every side of a knucklebone has shape words, no two the same, and nothing numbers them", () => {
  const shapes = facesOf("knucklebone").map((f) => sideShape(f));
  assert.ok(shapes.every((s) => !!s));
  assert.equal(new Set(shapes).size, 4);
  assert.deepEqual(shapes.map((s) => s!.split(" and ")[0]), ["broad", "broad", "narrow", "narrow"]);
  assert.equal(sideShape("e"), null);
  assert.equal(sideShape("heads"), null);
  for (const s of shapes) assert.ok(!/\d/.test(s!), "shape words carry no value");
});

test("the history note says the shape words are labels, not values, and cites sources that exist", () => {
  const section = DICE_HISTORY.find((s) => s.topic === "dice.knucklebone-sides")!;
  assert.ok(/do not say which side carried which value/.test(section.text));
  assert.ok(/own/.test(section.text));
  for (const id of CITES["dice.knucklebone-sides"]) assert.ok(getSource(id), id);
  assert.ok(CITES["dice.knucklebone-sides"].length >= 3, "the shape words rest on more than one source");
});

test("only the four knucklebone sides and the 25 ogham staves can be named, and a name is tidied and limited", () => {
  for (const f of ["a", "b", "c", "d"]) assert.equal(canNamePiece(`die-knucklebone-${f}`), true);
  for (const id of ["ogham-beith", "ogham-eabhadh", "ogham-eamhancholl"]) assert.equal(canNamePiece(id), true, id);
  for (const id of ["die-knucklebone-e", "die-d6-3", "coin-heads", "major-0", "", "die-knucklebone-a/../x", "ogham-koad", "ogham-"]) assert.equal(canNamePiece(id), false, id);
  assert.equal(cleanOwnName("  the   dog "), "the dog");
  assert.equal(cleanOwnName(""), null);
  assert.equal(cleanOwnName("   "), null);
  assert.equal(cleanOwnName(5), null);
  assert.equal(cleanOwnName("x".repeat(MAX_OWN_NAME)), "x".repeat(MAX_OWN_NAME));
  assert.equal(cleanOwnName("x".repeat(MAX_OWN_NAME + 1)), null);
});

test("an own name is shown beside the app's label, never instead of it", () => {
  assert.equal(withOwnName("Side A", "the dog"), "Side A: the dog");
  assert.equal(withOwnName("Side A", null), "Side A");
  assert.equal(withOwnName("Side A", undefined), "Side A");
  assert.deepEqual(namesById([{ piece_id: "die-knucklebone-a", name: "the dog" }]), { "die-knucklebone-a": "the dog" });
});

test("own names are in the export, with the piece in words", () => {
  const data = shapeOwnExport([], [], [], new Map(), { "die-knucklebone-b": "the bridge", "die-knucklebone-a": "the dog" });
  assert.deepEqual(data.own_names.map((n) => [n.piece_id, n.name]), [["die-knucklebone-a", "the dog"], ["die-knucklebone-b", "the bridge"]]);
  assert.equal(getFace("die-knucklebone-a")!.name, data.own_names[0].piece);
  const text = ownMarkdown(data).join("\n");
  assert.ok(text.includes("## Your own names for pieces") && text.includes("Knucklebone · Side A: the dog"));
  assert.deepEqual(ownMarkdown(shapeOwnExport([], [], [], new Map())), [], "nothing is written when there are none");
});

test("the route and the table are private to the person", () => {
  const route = readFileSync(path.join(__dirname, "..", "app", "api", "own", "names", "[pieceId]", "route.ts"), "utf8");
  assert.ok(route.includes("requireUser()") && route.includes("canNamePiece(pieceId)"));
  const lib = readFileSync(path.join(__dirname, "..", "lib", "own-names.ts"), "utf8");
  assert.ok(lib.split("query").filter((_, i) => i > 0).length >= 3);
  assert.ok(/WHERE user_id = \$1/.test(lib) && /ON CONFLICT \(user_id, piece_id\)/.test(lib) && /DELETE FROM symbol_own_names WHERE user_id = \$1 AND piece_id = \$2/.test(lib));
  const sql = readFileSync(path.join(__dirname, "..", "migrations", "076_own_piece_names.sql"), "utf8");
  assert.ok(/REFERENCES users\(id\) ON DELETE CASCADE/.test(sql) && /IF NOT EXISTS/.test(sql));
});
