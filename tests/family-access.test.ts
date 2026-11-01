import { test } from "node:test";
import assert from "node:assert/strict";
import { familyCircleAllowed, familyGateRequired, configuredFamilyCircleId } from "../lib/family-access-core";
import { readFileSync } from "node:fs";

test("production hosted access requires a configured positive circle ID", () => {
  assert.equal(familyGateRequired({ edition: "hosted", nodeEnv: "production", familyCircleId: "" }), true);
  assert.equal(familyCircleAllowed(42, { edition: "hosted", nodeEnv: "production", familyCircleId: "42" }), true);
  assert.equal(familyCircleAllowed(43, { edition: "hosted", nodeEnv: "production", familyCircleId: "42" }), false);
  for (const id of [null, undefined, 0, 42]) {
    assert.equal(familyCircleAllowed(id, { edition: "hosted", nodeEnv: "production", familyCircleId: "" }), false);
  }
});

test("a local edition bypasses the hosted circle gate", () => {
  const local = { edition: "local", nodeEnv: "production", familyCircleId: "42", localDataDir: "C:\\Users\\person\\DivinationStation" };
  assert.equal(familyGateRequired(local), false);
  assert.equal(familyCircleAllowed(null, local), true);
  assert.equal(familyGateRequired({ edition: "local", nodeEnv: "production", familyCircleId: "", localDataDir: "" }), true);
  assert.equal(familyGateRequired({ edition: "local", nodeEnv: "development", familyCircleId: "", localDataDir: "" }), true);
  assert.equal(
    familyGateRequired({ edition: "local", nodeEnv: "production", familyCircleId: "", localDataDir: "C:\\Users\\person\\DivinationStation" }),
    false
  );
});

test("development remains usable without a family setting and applies it when configured", () => {
  assert.equal(familyGateRequired({ edition: "hosted", nodeEnv: "development", familyCircleId: "" }), false);
  assert.equal(familyCircleAllowed(42, { edition: "hosted", nodeEnv: "development", familyCircleId: "42" }), true);
  assert.equal(familyCircleAllowed(43, { edition: "hosted", nodeEnv: "development", familyCircleId: "42" }), false);
});

test("family circle IDs reject empty, malformed and unsafe values", () => {
  assert.equal(configuredFamilyCircleId("42"), 42);
  for (const value of ["", "0", "01", "-1", "1.5", "abc", "9007199254740992"]) {
    assert.equal(configuredFamilyCircleId(value), null, value);
  }
});

test("all non-session entry points enforce the family boundary", () => {
  const read = (file: string) => readFileSync(file, "utf8");
  const login = read("app/api/auth/login/route.ts");
  const join = read("app/api/auth/join/route.ts");
  const setup = read("app/api/setup/route.ts");
  const claude = read("lib/claude-api.ts");
  const workers = read("lib/worker-tokens.ts");
  const session = read("lib/session.ts");

  assert.match(login, /familyUserAllowed\(user\.id\)/);
  assert.match(join, /familyCircleAllowed\(peeked\.circle_id\)/);
  assert.match(join, /!familyOnly && looksLikeCode\(code\)/);
  assert.match(setup, /if \(familyGateRequired\(\)\)/);
  assert.match(claude, /familyUserAllowed\(userId\)/);
  assert.match(workers, /familyCircleAllowed\(worker\.circleId\)/);
  assert.match(session, /familyCircleAllowed\(state\?\.circle_id\)/);
  assert.match(session, /if \(familyGateRequired\(\)\)/);
});
