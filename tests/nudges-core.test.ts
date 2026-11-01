import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NUDGE_KINDS, dismissedMessage, parseDismissal } from "../lib/nudges-core";

test("a dismissal is a known kind and a positive whole id", () => {
  assert.deepEqual(parseDismissal({ kind: "prediction", id: 4 }), { kind: "prediction", id: 4 });
  assert.deepEqual(parseDismissal({ kind: "lookback", id: 1 }), { kind: "lookback", id: 1 });
  assert.deepEqual(parseDismissal({ kind: "guess", id: 9 }), { kind: "guess", id: 9 });
  for (const bad of [null, "x", {}, { kind: "reading", id: 4 }, { kind: "prediction" }, { kind: "prediction", id: "4" },
    { kind: "prediction", id: 0 }, { kind: "prediction", id: -2 }, { kind: "prediction", id: 1.5 }, { kind: "lookback", id: 2 ** 60 }]) {
    assert.equal(parseDismissal(bad), null, JSON.stringify(bad));
  }
});

test("after dismissing, the page says where the thing still is", () => {
  for (const kind of NUDGE_KINDS) assert.match(dismissedMessage(kind), /^Dismissed\. .+ still /);
});

test("the migrations allow exactly the kinds the code knows", () => {
  const sql = readFileSync(new URL("../migrations/061_nudge_dismissals.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS/);
  assert.match(sql, /ON DELETE CASCADE/);
  // 091 replaces the kinds check; the latest list is the one in force.
  const latest = readFileSync(new URL("../migrations/091_nudge_guess_kind.sql", import.meta.url), "utf8");
  const check = latest.match(/ADD CONSTRAINT nudge_dismissals_kind_check CHECK \(kind IN \(([^)]*)\)\)/);
  assert.ok(check, "091 adds the kinds check back");
  const allowed = [...check[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(allowed, [...NUDGE_KINDS].sort());
  assert.match(latest, /DROP CONSTRAINT IF EXISTS nudge_dismissals_kind_check/);
});

test("the nudges' shared file imports no database code, so the page in the browser can use it", () => {
  const source = readFileSync(new URL("../lib/nudges-core.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./divination-kinds"]);
  const screen = readFileSync(new URL("../components/Nudges.tsx", import.meta.url), "utf8");
  assert.ok(!/@\/lib\/(nudges|db)"/.test(screen), "components/Nudges.tsx must import lib/nudges-core, not lib/nudges or lib/db");
});
