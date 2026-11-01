import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NO_HIDDEN, hiddenKey, hiddenMarkdown, shapeHiddenExport, visibleLinksOf } from "../lib/hidden-links-core";
import { EMPTY_STORE, type SymbolStore } from "../lib/symbol-links-core";

const store: SymbolStore = {
  links: new Map([
    ["rune-fehu", [
      { slug: "wealth-resources", aspect: "neutral", basis: "poem", primary: true },
      { slug: "security-stability", aspect: "light", basis: "name", primary: false },
    ]],
  ]),
  recorded: new Set(["rune-fehu", "ogham-oir"]),
  notes: new Map(),
};

test("with nothing hidden a piece has all its links, from the database or from the older mapping", () => {
  assert.deepEqual(visibleLinksOf(store, NO_HIDDEN, "rune-fehu", []).map((l) => l.slug), ["wealth-resources", "security-stability"]);
  assert.deepEqual(visibleLinksOf(EMPTY_STORE, NO_HIDDEN, "x", ["a", "b"]).map((l) => l.slug), ["a", "b"]);
});

test("a hidden link is left out for that person and the other links stay, in order", () => {
  const hidden = new Set([hiddenKey("rune-fehu", "wealth-resources")]);
  assert.deepEqual(visibleLinksOf(store, hidden, "rune-fehu", []).map((l) => l.slug), ["security-stability"]);
  assert.deepEqual(visibleLinksOf(store, NO_HIDDEN, "rune-fehu", []).length, 2, "the shared store is not changed");
});

test("hiding a link of one piece does not hide the same archetype on another piece", () => {
  const hidden = new Set([hiddenKey("rune-fehu", "wealth-resources")]);
  assert.deepEqual(visibleLinksOf(EMPTY_STORE, hidden, "rune-uruz", ["wealth-resources"]).map((l) => l.slug), ["wealth-resources"]);
});

test("hiding every link leaves none, and the older mapping in code does not come back for a recorded piece", () => {
  const hidden = new Set([hiddenKey("rune-fehu", "wealth-resources"), hiddenKey("rune-fehu", "security-stability")]);
  assert.deepEqual(visibleLinksOf(store, hidden, "rune-fehu", ["wealth-resources"]), []);
});

test("the hidden links are in the export by name, with the day, and the readable form is empty when none are hidden", () => {
  const data = shapeHiddenExport(
    [{ symbol_id: "rune-fehu", archetype: "Wealth and Resources", created_at: "2026-10-17T12:00:00Z" }],
    (id) => (id === "rune-fehu" ? "Fehu (rune)" : id)
  );
  assert.deepEqual(data.hidden_shared_links, [{ piece: "Fehu (rune)", archetype: "Wealth and Resources", hidden_on: "2026-10-17" }]);
  assert.match(hiddenMarkdown(data).join("\n"), /- Fehu \(rune\): Wealth and Resources \(hidden 2026-10-17\)/);
  assert.deepEqual(hiddenMarkdown(shapeHiddenExport([], (id) => id)), []);
});

test("the migration is idempotent, per person, and goes with the account and the archetype", () => {
  const sql = readFileSync(new URL("../migrations/073_hidden_symbol_links.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_hidden_links/);
  assert.match(sql, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /REFERENCES archetypes\(id\) ON DELETE CASCADE/);
  assert.match(sql, /PRIMARY KEY \(user_id, symbol_id, archetype_id\)/);
});

test("the browser code uses only the pure file, and no model-facing code reads the hidden links", () => {
  const core = readFileSync(new URL("../lib/hidden-links-core.ts", import.meta.url), "utf8");
  assert.deepEqual([...core.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]), ["./symbol-links-core"]);
  const screen = readFileSync(new URL("../components/SymbolArchetypes.tsx", import.meta.url), "utf8");
  assert.ok(!/@\/lib\/(hidden-links|db)"/.test(screen));
  for (const file of ["lib/companion-context.ts", "lib/companion-own.ts", "lib/reading-context.ts"]) {
    let text = "";
    try { text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8"); } catch { continue; }
    assert.ok(!/hidden-links|user_hidden_links/.test(text), `${file} must not read hidden links`);
  }
});
