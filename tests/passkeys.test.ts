import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHALLENGE_MINUTES, cleanPasskeyName, freshChallenge, siteOf } from "../lib/passkeys-core";

test("a passkey's name is one trimmed line of at most 60 characters", () => {
  assert.equal(cleanPasskeyName("  My   phone \n "), "My phone");
  assert.equal(cleanPasskeyName("x".repeat(80))?.length, 60);
  assert.equal(cleanPasskeyName("   "), null);
  assert.equal(cleanPasskeyName(7), null);
});

test("a challenge counts only for its own purpose and only while fresh", () => {
  const at = 1_000_000;
  const pending = { c: "abc", for: "add" as const, at };
  assert.equal(freshChallenge(pending, "add", at + 1000), "abc");
  assert.equal(freshChallenge(pending, "signin", at + 1000), null);
  assert.equal(freshChallenge(pending, "add", at + CHALLENGE_MINUTES * 60_000 + 1), null);
  assert.equal(freshChallenge(pending, "add", at - 1), null);
  assert.equal(freshChallenge(undefined, "add", at), null);
});

test("the site is the host name without the port, and the origin keeps it", () => {
  assert.deepEqual(siteOf("http://localhost:3101/api/passkeys"), { rpID: "localhost", origin: "http://localhost:3101" });
  assert.deepEqual(siteOf("https://example.org/api/auth/login/passkey"), { rpID: "example.org", origin: "https://example.org" });
});

test("both verify routes use the challenge once, and sign-in is public only under /api/auth/login", () => {
  for (const f of ["app/api/passkeys/verify/route.ts", "app/api/auth/login/passkey/route.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(src.indexOf("delete session.pk") < src.indexOf("request.json()"), f);
  }
  assert.match(readFileSync("proxy.ts", "utf8"), /"\/api\/auth\/login"/);
});

test("adding a passkey asks for the current password, and a password reset removes passkeys", () => {
  assert.match(readFileSync("app/api/passkeys/route.ts", "utf8"), /verifyUserPassword\(session\.username, password\)/);
  assert.match(readFileSync("app/api/auth/recover/route.ts", "utf8"), /removeAllPasskeys\(userId\)/);
  assert.match(readFileSync("app/api/admin/users/[id]/route.ts", "utf8"), /removeAllPasskeys\(userId\)/);
});
