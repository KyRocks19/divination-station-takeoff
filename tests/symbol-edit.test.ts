import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeAdminAction } from "../lib/admin-log-core";
import { MAX_STOCK_LINKS, MAX_STOCK_NOTE, cleanStockLinks, isStockPiece, stockPieces } from "../lib/symbol-edit-core";

const link = (slug: string, aspect = "neutral", basis = "modern") => ({ slug, aspect, basis });

test("the pieces an admin may edit are the seeded stock ones: runes, ogham, coin and dice, five swings, three surfaces", () => {
  const pieces = stockPieces();
  assert.equal(pieces.length, 24 + 25 + 2 + (4 + 6 + 8 + 10 + 12 + 20 + 100) + 5 + 3);
  assert.equal(new Set(pieces.map((p) => p.id)).size, pieces.length, "no id twice");
  for (const p of pieces) assert.ok(p.name && p.group, p.id);
  assert.ok(isStockPiece("rune-fehu") && isStockPiece("coin-heads") && isStockPiece("die-d100-100") && isStockPiece("swing-circle_cw") && isStockPiece("scrying-ball"));
});

test("a tarot card, a line a person added, and an invented id are not editable here", () => {
  for (const id of ["major-0", "cups-ace", "swing-line-45", "die-d6-7", "rune-nope", "oracle-5", "../x", ""]) assert.equal(isStockPiece(id), false, id);
});

test("good links are accepted as they are, the first one being the main one", () => {
  const r = cleanStockLinks({ links: [link("courage-strength", "light", "poem"), link("fear-anxiety", "shadow", "name")], note: "  two\nlinks  " });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.links.map((l) => [l.slug, l.aspect, l.basis]), [["courage-strength", "light", "poem"], ["fear-anxiety", "shadow", "name"]]);
    assert.equal(r.note, "two links");
  }
});

test("bad links are refused with a plain reason", () => {
  const err = (body: unknown) => {
    const r = cleanStockLinks(body);
    assert.equal(r.ok, false);
    return r.ok ? "" : r.error;
  };
  assert.match(err(null), /list/);
  assert.match(err({ links: "x" }), /list/);
  assert.match(err({ links: [link("not-an-archetype")] }), /not one the app has/);
  assert.match(err({ links: [link("courage-strength"), link("courage-strength")] }), /twice/);
  assert.match(err({ links: [link("courage-strength", "sideways")] }), /side/);
  assert.match(err({ links: [link("courage-strength", "light", "folk-wisdom")] }), /drawn from/);
  assert.match(err({ links: Array.from({ length: MAX_STOCK_LINKS + 1 }, () => link("courage-strength")) }), /at most/);
  assert.match(err({ links: [link("courage-strength")], note: 5 }), /text/);
  assert.match(err({ links: [link("courage-strength")], note: "x".repeat(MAX_STOCK_NOTE + 1) }), /at most/);
});

test("a piece with no archetype needs a note saying why, so that it reads as a decision", () => {
  assert.equal(cleanStockLinks({ links: [], note: "" }).ok, false);
  assert.equal(cleanStockLinks({ links: [] }).ok, false);
  const r = cleanStockLinks({ links: [], note: "No tradition names one." });
  assert.ok(r.ok);
});

test("every basis an admin can pick has a short label", async () => {
  const { BASIS_KEYS } = await import("../lib/symbol-archetype-map");
  const { BASIS_LABELS } = await import("../lib/symbol-links-core");
  for (const b of BASIS_KEYS) assert.ok(BASIS_LABELS[b], b);
});

test("the admin log says what changed in words", () => {
  assert.equal(
    describeAdminAction({ action: "symbol_links_changed", target_name: "Fehu (rune)", detail: "3 to 2 archetypes" }),
    "changed the shared archetypes of “Fehu (rune)” (3 to 2 archetypes)"
  );
});

test("only an admin can save, the change is logged, and the editing screen does not pull in the tools' data", () => {
  const route = readFileSync(new URL("../app/api/symbols/[id]/archetypes/route.ts", import.meta.url), "utf8");
  const put = route.slice(route.indexOf("export async function PUT"));
  assert.match(put, /if \(!session\.userId\)/);
  assert.match(put, /if \(!session\.isAdmin\)[^\n]*403/);
  assert.match(put, /logAdminAction\(session, "symbol_links_changed"/);
  const screen = readFileSync(new URL("../components/archetypes/PieceLinksEditor.tsx", import.meta.url), "utf8");
  const imports = [...screen.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.includes("@/lib/symbol-edit-core") && !imports.includes("@/lib/symbol-edit") && !imports.includes("@/lib/db"), imports.join(", "));
  const shared = readFileSync(new URL("../lib/symbol-edit-shared.ts", import.meta.url), "utf8");
  assert.deepEqual([...shared.matchAll(/\bfrom\s+"([^"]+)"/g)], [], "the shared file imports nothing");
});
