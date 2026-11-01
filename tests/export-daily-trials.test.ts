import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanDailyTrialRow } from "../lib/import-tools-core";

// NT1: the daily five-shape trials of blind-target practice and the trial facts the person shared are in the export, and the
// judged trials come back in on an import. A waiting trial is never exported, so its target and secret number stay unread.

const seal = "a".repeat(64);
const row = { started_at: "2026-10-20T09:00:00.000Z", chosen_at: "2026-10-20T09:01:00.000Z", target: "Star", your_choice: "Wave", chose_the_target: false, seal, secret_number: "0123abcd" };

test("a judged daily trial is read back by shape name, with its seal and secret number as they were", () => {
  assert.deepEqual(cleanDailyTrialRow(row), { target_index: 3, choice_index: 4, seal, secret: "0123abcd", started_at: row.started_at, chosen_at: row.chosen_at });
});

test("a daily trial with an unknown shape, no choice, a bad seal or no date is left out", () => {
  assert.equal(cleanDailyTrialRow({ ...row, target: "Moon" }), null);
  assert.equal(cleanDailyTrialRow({ ...row, your_choice: null }), null);
  assert.equal(cleanDailyTrialRow({ ...row, seal: "not a seal" }), null);
  assert.equal(cleanDailyTrialRow({ ...row, secret_number: "" }), null);
  assert.equal(cleanDailyTrialRow({ ...row, started_at: "yesterday" }), null);
  assert.equal(cleanDailyTrialRow(null), null);
});

test("the export reads only judged daily trials, and only the person's own shared facts", () => {
  const src = readFileSync(new URL("../lib/export-tools.ts", import.meta.url), "utf8");
  assert.match(src, /FROM remoteview_daily WHERE user_id = \$1 AND judged_at IS NOT NULL/);
  assert.match(src, /JOIN remoteview_share s ON s\.token = f\.token\s+WHERE s\.user_id = \$1/);
  assert.doesNotMatch(src, /blind_target_shared_facts: factRows\.map\(\(f\) => \(\{[^}]*token/, "the pseudonymous code is not written into the export");
});

test("the import reads the daily trials back and says it does", () => {
  assert.match(readFileSync(new URL("../lib/import.ts", import.meta.url), "utf8"), /"blind_target_daily"/);
  assert.match(readFileSync(new URL("../lib/import-tools.ts", import.meta.url), "utf8"), /INSERT|insertMany\(client, "remoteview_daily"/);
});
