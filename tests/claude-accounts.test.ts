import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isClaudeAccountName, parseClaudeAccountView, splitClaudeAccounts } from "../lib/claude-accounts";

test("Claude's test account names are recognised, other names are not", () => {
  for (const name of ["claude", "Claude", "claude-1014-src", "claude-1013-4bb2ba18"]) assert.equal(isClaudeAccountName(name), true, name);
  for (const name of ["claudette", "claudia", "my-claude", "", "cl"]) assert.equal(isClaudeAccountName(name), false, name);
});

const user = (username: string, is_admin = 0) => ({ username, is_admin });

test("test accounts are split from people; admins and the viewer are never hidden", () => {
  const list = [user("ky", 1), user("claude"), user("claude-1012-iym"), user("june"), user("claude-boss", 1), user("claude-me")];
  const { people, claude } = splitClaudeAccounts(list, "claude-me");
  assert.deepEqual(claude.map((u) => u.username), ["claude", "claude-1012-iym"]);
  assert.deepEqual(people.map((u) => u.username), ["ky", "june", "claude-boss", "claude-me"]);
});

test("a saved view is read back, and anything else means one row", () => {
  assert.equal(parseClaudeAccountView("each"), "each");
  assert.equal(parseClaudeAccountView("hide"), "hide");
  assert.equal(parseClaudeAccountView("group"), "group");
  assert.equal(parseClaudeAccountView(null), "group");
  assert.equal(parseClaudeAccountView("nonsense"), "group");
});

test("the file imports nothing", () => {
  const source = readFileSync(new URL("../lib/claude-accounts.ts", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]), []);
});
