import { test } from "node:test";
import assert from "node:assert/strict";
import { INVITE_DAYS, hashCode, inviteStatus, joinProblem, looksLikeCode, makeCode, normalizeCode } from "../lib/invites";

test("a made code has the shape XXXX-XXXX-XXXX with no look-alike characters, and two are different", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = makeCode();
    assert.match(c, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    assert.ok(looksLikeCode(normalizeCode(c)));
    seen.add(c);
  }
  assert.equal(seen.size, 200);
});

test("what is typed is reduced to the same code whatever the spaces, dashes, and capitals", () => {
  assert.equal(normalizeCode("k7qm-2xpd 9twr"), "K7QM2XPD9TWR");
  assert.equal(normalizeCode("  K7QM 2XPD 9TWR \n"), "K7QM2XPD9TWR");
  assert.equal(normalizeCode(undefined), "");
  assert.equal(normalizeCode(12345), "");
  assert.equal(hashCode(normalizeCode("k7qm-2xpd-9twr")), hashCode("K7QM2XPD9TWR"));
  assert.notEqual(hashCode("K7QM2XPD9TWR"), hashCode("K7QM2XPD9TWS"));
  assert.equal(looksLikeCode("SHORT"), false);
});

test("a code is waiting until it is used, revoked, or past its date; used wins over the rest", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal(inviteStatus({ used_at: null, revoked_at: null, expires_at: future }), "waiting");
  assert.equal(inviteStatus({ used_at: null, revoked_at: null, expires_at: past }), "expired");
  assert.equal(inviteStatus({ used_at: null, revoked_at: past, expires_at: future }), "revoked");
  assert.equal(inviteStatus({ used_at: past, revoked_at: past, expires_at: past }), "used");
  assert.equal(INVITE_DAYS, 14);
});

test("a joining person's username and password are checked in plain words", () => {
  assert.equal(joinProblem("ashley_1", "a long enough password", null), null);
  assert.match(joinProblem("a", "a long enough password", null)!, /username/);
  assert.match(joinProblem("has space", "a long enough password", null)!, /username/);
  assert.match(joinProblem("x".repeat(41), "a long enough password", null)!, /username/);
  assert.match(joinProblem("ashley", "short", null)!, /at least 12/);
  assert.match(joinProblem("ashley", "p".repeat(201), null)!, /too long/);
  assert.match(joinProblem("ashley", "a long enough password", "n".repeat(61))!, /display name/);
});
