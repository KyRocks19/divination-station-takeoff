import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_ACTIONS, clipDetail, describeAdminAction } from "../lib/admin-log-core";

test("every logged action has words, and an unknown one still reads", () => {
  for (const action of ADMIN_ACTIONS) {
    const text = describeAdminAction({ action, target_name: "kylie", detail: "x" });
    assert.ok(text.length > 5 && !text.includes("did “"), action);
  }
  assert.equal(describeAdminAction({ action: "mystery", target_name: null, detail: null }), "did “mystery”");
});

test("the person acted on is named, or called an account when the name is gone", () => {
  assert.equal(describeAdminAction({ action: "password_reset", target_name: "kylie", detail: null }), "reset the password of “kylie”");
  assert.equal(describeAdminAction({ action: "account_off", target_name: null, detail: null }), "switched off an account");
});

test("a limit says what it was set to", () => {
  assert.equal(describeAdminAction({ action: "ai_limit_set", target_name: "k", detail: "20" }), "set the daily Claude limit of “k” to 20");
});

test("a detail is flattened and cut so a row stays short", () => {
  assert.equal(clipDetail("a\n\n  b"), "a b");
  assert.equal(clipDetail("x".repeat(500))!.length, 120);
  assert.equal(clipDetail("   "), null);
  assert.equal(clipDetail(5), null);
});
