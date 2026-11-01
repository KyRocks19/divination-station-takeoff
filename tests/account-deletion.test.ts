import test from "node:test";
import assert from "node:assert/strict";
import { DELETE_PHRASE, deletionProblem, phraseMatches } from "../lib/account-deletion";

const ok = { phrase: DELETE_PHRASE, password: "a long password", isAdmin: false, otherActiveAdmins: 0 };

test("the phrase ignores capitals and spaces at the ends, and nothing else", () => {
  assert.ok(phraseMatches("Delete My Account"));
  assert.ok(phraseMatches("  delete my account \n"));
  assert.ok(!phraseMatches("delete account"));
  assert.ok(!phraseMatches(""));
  assert.ok(!phraseMatches(undefined));
  assert.ok(!phraseMatches(["delete my account"]));
});

test("a password and the phrase are both needed", () => {
  assert.equal(deletionProblem(ok), null);
  assert.match(deletionProblem({ ...ok, password: "" })!, /password/i);
  assert.match(deletionProblem({ ...ok, password: 5 })!, /password/i);
  assert.match(deletionProblem({ ...ok, phrase: "no" })!, /delete my account/);
});

test("the only admin cannot delete themselves; an admin with another admin can; an ordinary person is not asked", () => {
  assert.match(deletionProblem({ ...ok, isAdmin: true, otherActiveAdmins: 0 })!, /only admin/);
  assert.equal(deletionProblem({ ...ok, isAdmin: true, otherActiveAdmins: 1 }), null);
  assert.equal(deletionProblem({ ...ok, isAdmin: false, otherActiveAdmins: 0 }), null);
});
