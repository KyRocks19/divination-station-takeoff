import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNTS_FULL, DEFAULT_MAX_ACCOUNTS, accountCap, mayJoin } from "../lib/account-cap-core";

test("the ceiling is 200 unless MAX_ACCOUNTS says another whole number", () => {
  assert.equal(accountCap(undefined), DEFAULT_MAX_ACCOUNTS);
  assert.equal(accountCap(""), DEFAULT_MAX_ACCOUNTS);
  assert.equal(accountCap("  "), DEFAULT_MAX_ACCOUNTS);
  assert.equal(accountCap("50"), 50);
  assert.equal(accountCap("0"), 0);
  assert.equal(accountCap("-3"), DEFAULT_MAX_ACCOUNTS);
  assert.equal(accountCap("12.5"), DEFAULT_MAX_ACCOUNTS);
  assert.equal(accountCap("lots"), DEFAULT_MAX_ACCOUNTS);
});

test("one more person may join below the ceiling, not at it; 0 means no ceiling", () => {
  assert.equal(mayJoin(199, 200), true);
  assert.equal(mayJoin(200, 200), false);
  assert.equal(mayJoin(500, 200), false);
  assert.equal(mayJoin(100000, 0), true);
});

test("the refusal says the code was not used and does not blame the person", () => {
  assert.match(ACCOUNTS_FULL, /not been used/);
  assert.doesNotMatch(ACCOUNTS_FULL, /you (did|must|should)/i);
});
