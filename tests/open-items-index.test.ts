import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndex, parseOpenItems, summarise } from "../lib/open-items-index-core";

const SAMPLE = [
  "## A. Open code work",
  "",
  "| ID | Status | Item | Evidence |",
  "|---|---|---|---|",
  "| S10 | CODE | Optional passkeys (WebAuthn) as another way to sign in. | none found |",
  "| ED15b**TODO** | CODE | Add selective Markdown sharing. More detail follows here. | `x.ts` |",
  "| O14 | OWNER | Run `export X=\"$(a \\| b)\"` then go. | `y.ts` |",
  "## C. Decisions",
  "| H1b | PARKED | Add a check button? | default |",
  "| not an id | x | y | z |",
].join("\n");

test("parses rows, tolerates a broken ID cell and escaped pipes", () => {
  const rows = parseOpenItems(SAMPLE);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["S10", "ED15b", "O14", "H1b"],
  );
  assert.equal(rows[0].section, "A. Open code work");
  assert.equal(rows[3].section, "C. Decisions");
  assert.match(rows[2].summary, /a \| b/);
});

test("summary stops at the first sentence and never runs past the limit", () => {
  assert.equal(summarise("Add selective Markdown sharing. More detail follows here."), "Add selective Markdown sharing.");
  const long = "word ".repeat(80);
  assert.ok(summarise(long).length <= 151);
  assert.ok(summarise(long).endsWith("…"));
});

test("the index lists every row of the real open-items file once", () => {
  const source = readFileSync("docs/open-items.md", "utf8");
  const rows = parseOpenItems(source);
  assert.ok(rows.length > 30);
  const ids = rows.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "an ID appears twice in docs/open-items.md");
  const index = buildIndex(source);
  for (const id of ids) assert.ok(index.includes(`**${id}**`), id);
});

test("docs/open-items-index.md is up to date", () => {
  const source = readFileSync("docs/open-items.md", "utf8");
  const current = readFileSync("docs/open-items-index.md", "utf8");
  assert.equal(current, buildIndex(source), "run: npx tsx scripts/open-items-index.ts");
});
