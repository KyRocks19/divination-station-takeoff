import test from "node:test";
import assert from "node:assert/strict";
import { CLAUDE_TOKEN_PREFIX, MAX_TOKEN_NAME, cleanTokenName, personalTokenFrom } from "../lib/claude-tokens-core";
import { hashClaudeToken, makeClaudeToken } from "../lib/claude-tokens";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

test("a token is prefixed, long, different every time, and hashed to something that is not the token", () => {
  const a = makeClaudeToken();
  const b = makeClaudeToken();
  assert.ok(a.startsWith(CLAUDE_TOKEN_PREFIX));
  assert.ok(a.length >= 40);
  assert.notEqual(a, b);
  assert.match(hashClaudeToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashClaudeToken(a), a);
  assert.equal(hashClaudeToken(a), hashClaudeToken(a));
});

test("the token is read from X-Claude-Key or a Bearer header, and the old shared key is not mistaken for one", () => {
  const t = makeClaudeToken();
  assert.equal(personalTokenFrom(headers({ "x-claude-key": t })), t);
  assert.equal(personalTokenFrom(headers({ authorization: `Bearer ${t}` })), t);
  assert.equal(personalTokenFrom(headers({ "x-claude-key": "some-shared-secret-without-prefix-0123456789" })), null);
  assert.equal(personalTokenFrom(headers({ "x-claude-key": "dsc_short" })), null);
  assert.equal(personalTokenFrom(headers({})), null);
  assert.equal(personalTokenFrom(headers({ authorization: "Bearer dsw_" + "x".repeat(40) })), null); // a picture computer's token is not one of these
});

test("a token needs a name of reasonable length", () => {
  assert.deepEqual(cleanTokenName("  Laptop "), { ok: true, name: "Laptop" });
  assert.equal(cleanTokenName("").ok, false);
  assert.equal(cleanTokenName("   ").ok, false);
  assert.equal(cleanTokenName(5).ok, false);
  assert.equal(cleanTokenName("x".repeat(MAX_TOKEN_NAME + 1)).ok, false);
});
