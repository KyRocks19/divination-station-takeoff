import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The owner chose "AGPL 3.0 only" on 2026-10-18 (open item ED19). The licence is named the same way everywhere it is named.
test("the code's licence is AGPL-3.0-only in package.json, the studio download and the README", () => {
  assert.equal(JSON.parse(read("package.json")).license, "AGPL-3.0-only");
  assert.match(read("scripts/build-studio-package.ts"), /license: "AGPL-3\.0-only"/);
  assert.match(read("README.md"), /AGPL-3\.0-only/);
  assert.doesNotMatch(read("README.md") + read("NOTICE"), /AGPL-3\.0-or-later/);
});

test("the LICENSE file is the GNU Affero General Public License version 3", () => {
  const text = read("LICENSE");
  assert.match(text, /GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3, 19 November 2007/);
});
