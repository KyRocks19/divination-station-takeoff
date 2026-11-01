import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_RECENT, NO_RECENT, recentMarkdown, recentToKeep, shapeRecentExport } from "../lib/recent-searches-core";

test("only real words are kept: cleaned like the search, at least two letters, at most the search's longest", () => {
  assert.equal(recentToKeep("  full   moon "), "full moon");
  assert.equal(recentToKeep("a"), null);
  assert.equal(recentToKeep("   "), null);
  assert.equal(recentToKeep(undefined), null);
  assert.equal(recentToKeep(42), null);
  assert.equal(recentToKeep("x".repeat(500))?.length, 100);
});

test("nothing saved and the switch off is the starting state", () => {
  assert.deepEqual(NO_RECENT, { on: false, items: [] });
});

test("the export has the words and the day, newest first, and says whether remembering is on", () => {
  const data = shapeRecentExport({
    on: true,
    items: [
      { id: 2, query: "hekate", searched_at: "2026-10-17T10:00:00.000Z" },
      { id: 1, query: "moon", searched_at: "2026-10-16T09:00:00.000Z" },
    ],
  });
  assert.deepEqual(data.recent_searches.searches, [
    { words: "hekate", searched_at: "2026-10-17T10:00:00.000Z" },
    { words: "moon", searched_at: "2026-10-16T09:00:00.000Z" },
  ]);
  assert.equal(data.recent_searches.remembering, true);
  const md = recentMarkdown(data).join("\n");
  assert.match(md, /## Recent searches/);
  assert.match(md, /- hekate \(2026-10-17\)/);
  assert.match(md, /is on\./);
});

test("the readable export says nothing when the feature was never used", () => {
  assert.deepEqual(recentMarkdown(shapeRecentExport(NO_RECENT)), []);
  assert.deepEqual(recentMarkdown(shapeRecentExport({ on: false, items: [] })), []);
});

test("turning it off but still holding old searches would be shown, not hidden", () => {
  const md = recentMarkdown({ recent_searches: { remembering: false, searches: [{ words: "tower", searched_at: "2026-10-01T00:00:00Z" }] } });
  assert.match(md.join("\n"), /is off\./);
  assert.match(md.join("\n"), /tower/);
});

test("the migration is idempotent, off by default, capped by the code's limit, and goes with the account", () => {
  const sql = readFileSync(new URL("../migrations/071_recent_searches.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS remember_searches INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS recent_searches/);
  assert.match(sql, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS recent_searches_user_query ON recent_searches\(user_id, lower\(query\)\)/);
  assert.equal(MAX_RECENT, 20);
  // Every statement that makes something says IF NOT EXISTS.
  for (const m of sql.matchAll(/CREATE (TABLE|INDEX|UNIQUE INDEX)\b[^\n]*/g)) assert.match(m[0], /IF NOT EXISTS/);
});

test("the shared file imports no database code, and the search window uses it and not the database file", () => {
  const core = readFileSync(new URL("../lib/recent-searches-core.ts", import.meta.url), "utf8");
  const imports = [...core.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./search-shared"]);
  const window = readFileSync(new URL("../components/SiteSearch.tsx", import.meta.url), "utf8");
  assert.ok(!/@\/lib\/(recent-searches|db)"/.test(window), "components/SiteSearch.tsx must import lib/recent-searches-core");
});

test("nothing that talks to a model reads the saved searches", () => {
  for (const file of ["lib/companion-context.ts", "lib/companion-own.ts", "lib/reading-context.ts", "lib/patterns.ts"]) {
    let text = "";
    try {
      text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    } catch {
      continue;
    }
    assert.ok(!/recent_searches|recent-searches/.test(text), `${file} must not read recent searches`);
  }
});
