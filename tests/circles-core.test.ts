import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CIRCLE_PROBLEMS, MAX_ACCOUNTS_PER_CIRCLE, MAX_CIRCLE_MEMBERS, MAX_CIRCLE_NAME, MAX_CIRCLE_NOTE, circleMayMakeAccount, cleanCircleName, cleanCircleNote } from "../lib/circles-core";
import { hashCode, makeCode, normalizeCode } from "../lib/invites";

test("a circle's name is tidied and must be 1 to 60 characters of text", () => {
  assert.equal(cleanCircleName("  The   Crossroads  House "), "The Crossroads House");
  assert.equal(cleanCircleName(""), null);
  assert.equal(cleanCircleName("   "), null);
  assert.equal(cleanCircleName(42), null);
  assert.equal(cleanCircleName(null), null);
  assert.equal(cleanCircleName("x".repeat(MAX_CIRCLE_NAME)), "x".repeat(MAX_CIRCLE_NAME));
  assert.equal(cleanCircleName("x".repeat(MAX_CIRCLE_NAME + 1)), null);
});

test("a note on a code is optional and cut to 100 characters", () => {
  assert.equal(cleanCircleNote(undefined), null);
  assert.equal(cleanCircleNote("   "), null);
  assert.equal(cleanCircleNote(" for  Sam "), "for Sam");
  assert.equal(cleanCircleNote("y".repeat(300))!.length, MAX_CIRCLE_NOTE);
});

test("every problem has a plain sentence and a fitting status", () => {
  for (const [key, { status, error }] of Object.entries(CIRCLE_PROBLEMS)) {
    assert.ok([400, 403, 404, 409, 503].includes(status), `${key} has status ${status}`);
    assert.ok(error.length > 5 && error.endsWith("."), `${key} needs a sentence`);
  }
  // A wrong code must not say whether a circle exists, is full, or who owns it.
  assert.doesNotMatch(CIRCLE_PROBLEMS.bad_code.error, /full|owner|circle/i);
});

test("a circle's codes may make a limited number of accounts, twice the circle's size", () => {
  assert.equal(MAX_ACCOUNTS_PER_CIRCLE, 2 * MAX_CIRCLE_MEMBERS);
  assert.equal(circleMayMakeAccount(0), true);
  assert.equal(circleMayMakeAccount(MAX_ACCOUNTS_PER_CIRCLE - 1), true);
  assert.equal(circleMayMakeAccount(MAX_ACCOUNTS_PER_CIRCLE), false);
});

test("the join route asks for agreement before it makes anything, and removes the account if joining fails", () => {
  const route = readFileSync(path.join(__dirname, "..", "app", "api", "auth", "join", "route.ts"), "utf8");
  assert.ok(route.indexOf("body.agreed !== true") > -1 && route.indexOf("body.agreed !== true") < route.indexOf("createUser("), "agreement is checked before the account is made");
  assert.ok(/!joined\.ok[\s\S]{0,80}deleteUser\(user\.id\)/.test(route), "a failed join removes the account just made");
  assert.ok(route.indexOf("peekCircleCode") < route.indexOf("createUser("), "the circle code is only looked at, not used, before the account exists");
});

test("a code as shown to the owner and as typed by the person (any case, spaces, dashes) hash the same", () => {
  const code = makeCode();
  const stored = hashCode(normalizeCode(code));
  assert.equal(hashCode(normalizeCode(code.toLowerCase())), stored);
  assert.equal(hashCode(normalizeCode(` ${code.replace(/-/g, " ")} `)), stored);
  assert.notEqual(hashCode(normalizeCode(makeCode())), stored);
});

test("lib/circles-core.ts is safe for the browser: it imports nothing", () => {
  const source = readFileSync(path.join(process.cwd(), "lib", "circles-core.ts"), "utf8");
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test("the Circle page (a client component) never imports the database side", () => {
  const source = readFileSync(path.join(process.cwd(), "components", "CirclePanel.tsx"), "utf8");
  assert.match(source, /^"use client";/);
  assert.doesNotMatch(source, /from "@\/lib\/(circles|db|session|circles-http)"/);
});

test("every query in lib/circles.ts that changes a circle is tied to the person's own place in it", () => {
  const source = readFileSync(path.join(process.cwd(), "lib", "circles.ts"), "utf8");
  // Each exported action that takes a circle id checks ownership or membership before it writes.
  for (const fn of ["renameCircle", "deleteCircle", "createCircleInvite", "revokeCircleInvite", "handOverCircle"]) {
    const body = source.slice(source.indexOf(`export async function ${fn}(`)).split(/\nexport /)[0];
    assert.match(body, /await ownedCircle\(userId, circleId\)/, `${fn} checks that the person owns the circle`);
  }
  const remove = source.slice(source.indexOf("export async function removeMember(")).split(/\nexport /)[0];
  assert.match(remove, /await membership\(userId\)/, "removeMember checks the person is in that circle");
});

import { cleanClaudeKey, cleanClaudeLimit, SHARING_NOTICE, MAX_CLAUDE_MEMBER_LIMIT, HOST_SHARING_POINT, sharingPoints } from "../lib/circles-core";

test("a Claude key must look like an Anthropic key, and is trimmed", () => {
  const good = "sk-ant-api03-" + "a".repeat(30);
  assert.equal(cleanClaudeKey(`  ${good}\n`), good);
  assert.equal(cleanClaudeKey("sk-ant-short"), null);
  assert.equal(cleanClaudeKey("sk-proj-" + "a".repeat(40)), null);
  assert.equal(cleanClaudeKey("sk-ant-" + "a b ".repeat(10)), null);
  assert.equal(cleanClaudeKey(12345), null);
  assert.equal(cleanClaudeKey(undefined), null);
});

test("a daily limit is a whole number from 0 up to the largest allowed", () => {
  assert.equal(cleanClaudeLimit(15, 100), 15);
  assert.equal(cleanClaudeLimit("15", 100), 15);
  assert.equal(cleanClaudeLimit(0, 100), 0);
  assert.equal(cleanClaudeLimit("0", 100), 0);
  assert.equal(cleanClaudeLimit(101, 100), null);
  assert.equal(cleanClaudeLimit(-1, 100), null);
  assert.equal(cleanClaudeLimit(1.5, 100), null);
  assert.equal(cleanClaudeLimit("", 100), null);
  assert.equal(cleanClaudeLimit("lots", 100), null);
  assert.equal(cleanClaudeLimit(MAX_CLAUDE_MEMBER_LIMIT, MAX_CLAUDE_MEMBER_LIMIT), MAX_CLAUDE_MEMBER_LIMIT);
});

test("the notice before joining says where words go, what is not shared, and how to stop", () => {
  const text = SHARING_NOTICE.points.join(" ");
  assert.match(text, /none of your readings, journals/);
  assert.match(text, /Claude key/);
  assert.match(text, /Anthropic/);
  assert.match(text, /picture computer/);
  assert.match(text, /stop at any time/);
  // It must not promise what the app cannot know about someone's Anthropic account.
  assert.doesNotMatch(text, /cannot (see|read) (what|your)/i);
});

test("on a host copy the join notice first says the host's computer stores everything and they can read it", () => {
  assert.deepEqual([...sharingPoints(false)], [...SHARING_NOTICE.points]);
  assert.equal(sharingPoints(true)[0], HOST_SHARING_POINT);
  assert.match(HOST_SHARING_POINT, /they can read it/);
  assert.equal(sharingPoints(true).length, SHARING_NOTICE.points.length + 1);
});
