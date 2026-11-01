import test from "node:test";
import assert from "node:assert/strict";
import { RECOVERY_COUNT, remainingWords } from "../lib/recovery-core";
import { makeRecoverySet } from "../lib/recovery";
import { looksLikeCode, normalizeCode } from "../lib/invites";
import { SESSION_DAYS } from "../lib/account-state";

test("a set has the promised number of distinct, well-formed codes", () => {
  const set = makeRecoverySet();
  assert.equal(set.length, RECOVERY_COUNT);
  assert.equal(new Set(set).size, RECOVERY_COUNT);
  for (const c of set) {
    assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.ok(looksLikeCode(normalizeCode(c)));
  }
});

test("what is left is said in plain words", () => {
  assert.match(remainingWords({ remaining: 0, madeAt: null }), /not made/);
  assert.match(remainingWords({ remaining: 0, madeAt: "2026-10-17" }), /used all/);
  assert.equal(remainingWords({ remaining: 5, madeAt: "2026-10-17" }), `5 of ${RECOVERY_COUNT} recovery codes are unused.`);
});

test("a sign-in lasts two weeks, not a month", () => {
  assert.equal(SESSION_DAYS, 14);
});
