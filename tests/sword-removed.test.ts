import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { journalAuthorLabel } from "../lib/reading-context";

// The Sword of Truth was removed on 2026-10-17 (open item C7). Entries it wrote before then stay readable under a neutral name.
const read = (...p: string[]) => readFileSync(path.join(process.cwd(), ...p), "utf8");

test("the Sword's route is gone and nothing can write a new Sword entry", () => {
  assert.equal(existsSync(path.join(process.cwd(), "app", "api", "sword", "route.ts")), false);
  assert.doesNotMatch(read("app", "api", "journals", "route.ts"), /["']sword["']/);
  assert.doesNotMatch(read("app", "readings", "[id]", "page.tsx"), /api\/sword|askSword|Sword of Truth/);
});

test("an old Sword entry is labelled neutrally wherever it is shown, to people and to the AI", () => {
  assert.equal(journalAuthorLabel("sword"), "Earlier AI entry");
  assert.match(read("app", "api", "export", "route.ts"), /sword: "Earlier AI entry"/);
  assert.match(read("lib", "days.ts"), /sword: "an earlier AI entry"/);
  assert.match(read("app", "readings", "[id]", "page.tsx"), /return "Earlier AI entry"/);
  for (const file of [["lib", "reading-context.ts"], ["lib", "days.ts"], ["app", "api", "export", "route.ts"]]) {
    assert.doesNotMatch(read(...file), /Sword of Truth/, file.join("/"));
  }
});
