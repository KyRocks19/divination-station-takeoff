// Checks on the secrets a local copy makes for itself and on its first-run set-up (open item ED9, slice 2). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SECRET_NAMES, parseSecrets, resolveSecrets, secretsFileFor } from "../lib/local-secrets-core";
import { ensureLocalSecrets } from "../lib/local-secrets";
import { masterKey } from "../lib/secret-box";
import { reachedOnThisComputer } from "../lib/local-setup";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("the secrets file sits beside the data folder and is named after it", () => {
  assert.equal(secretsFileFor("C:/data/ds"), "C:/data/ds.secrets.json");
  assert.equal(secretsFileFor("C:\\data\\ds\\"), "C:\\data\\ds.secrets.json");
  assert.notEqual(secretsFileFor("/a/one"), secretsFileFor("/a/two"));
});

test("made secrets are long, different every time, and the circle key is a usable master key", () => {
  const a = resolveSecrets({}, {});
  const b = resolveSecrets({}, {});
  assert.deepEqual(a.made.sort(), [...SECRET_NAMES].sort());
  assert.ok((a.values.SESSION_SECRET ?? "").length >= 64);
  assert.notEqual(a.values.SESSION_SECRET, b.values.SESSION_SECRET);
  assert.ok(masterKey({ CIRCLE_KEY_SECRET: a.values.CIRCLE_KEY_SECRET }), "the circle key has the size lib/secret-box.ts needs");
});

test("a value in the environment wins, a value in the file is kept, a missing one is made", () => {
  const have = { SESSION_SECRET: "a".repeat(64) };
  const r = resolveSecrets(have, { CIRCLE_KEY_SECRET: "set-by-hand" });
  assert.equal(r.values.SESSION_SECRET, "a".repeat(64));
  assert.equal("CIRCLE_KEY_SECRET" in r.values, false);
  assert.deepEqual(r.made, []);
});

test("a damaged file is read as nothing rather than used", () => {
  assert.deepEqual(parseSecrets("not json"), {});
  assert.deepEqual(parseSecrets(JSON.stringify({ SESSION_SECRET: "short", CIRCLE_KEY_SECRET: 5 })), {});
  assert.deepEqual(parseSecrets(JSON.stringify({ SESSION_SECRET: "b".repeat(64), other: "x" })), { SESSION_SECRET: "b".repeat(64) });
});

test("first start makes and saves the secrets; the next start loads the same ones; an environment value is not overwritten", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "secrets-"));
  const data = path.join(dir, "data");
  const first: Record<string, string | undefined> = { DS_DB_DIR: data };
  const r1 = ensureLocalSecrets(first)!;
  assert.deepEqual([...r1.made].sort(), [...SECRET_NAMES].sort());
  assert.ok(existsSync(r1.file) && r1.file === secretsFileFor(data));
  assert.ok(first.SESSION_SECRET && first.SESSION_SECRET.length >= 64);
  assert.ok(!existsSync(data), "the data folder itself is not touched, so PGlite starts on an empty one");
  const second: Record<string, string | undefined> = { DS_DB_DIR: data };
  const r2 = ensureLocalSecrets(second)!;
  assert.deepEqual(r2.made, []);
  assert.equal(second.SESSION_SECRET, first.SESSION_SECRET);
  assert.equal(second.CIRCLE_KEY_SECRET, first.CIRCLE_KEY_SECRET);
  // Only one name set by hand: the file's other value is used and the hand-set one is left alone and not saved over.
  const third: Record<string, string | undefined> = { DS_DB_DIR: data, SESSION_SECRET: "by-hand-by-hand-by-hand-by-hand-by-hand" };
  ensureLocalSecrets(third);
  assert.equal(third.SESSION_SECRET, "by-hand-by-hand-by-hand-by-hand-by-hand");
  assert.equal(JSON.parse(readFileSync(r1.file, "utf8")).SESSION_SECRET, first.SESSION_SECRET);
  // A damaged file is replaced by fresh values (the old ones are gone either way).
  writeFileSync(r1.file, "garbage");
  const fourth: Record<string, string | undefined> = { DS_DB_DIR: data };
  assert.equal(ensureLocalSecrets(fourth)!.made.length, SECRET_NAMES.length);
});

test("a hosted copy (no DS_DB_DIR) makes nothing", () => {
  const env: Record<string, string | undefined> = {};
  assert.equal(ensureLocalSecrets(env), null);
  assert.equal(env.SESSION_SECRET, undefined);
});

test("set-up is only offered to this computer, and only while there is no account", () => {
  const direct = new Headers({ "x-forwarded-for": "127.0.0.1" });
  assert.ok(reachedOnThisComputer("localhost:3101", direct) && reachedOnThisComputer("127.0.0.1", direct) && reachedOnThisComputer("[::1]:47831", direct));
  assert.ok(!reachedOnThisComputer("192.168.1.20:3101", direct) && !reachedOnThisComputer("evil.example", direct) && !reachedOnThisComputer(null, direct));
  // A friend on the tailnet who writes "Host: localhost" is still refused: tailscale serve names them.
  assert.ok(!reachedOnThisComputer("localhost", new Headers({ "tailscale-user-login": "friend@example.com" })));
  assert.ok(!reachedOnThisComputer("localhost:47831", new Headers({ "x-forwarded-for": "100.101.102.103" })));
  const route = read("app/api/setup/route.ts");
  assert.ok(route.indexOf("reachedOnThisComputer(request") < route.indexOf("await needsSetup()"), "the host is checked first");
  assert.ok((route.match(/needsSetup\(\)/g) ?? []).length >= 2, "asked again once the request holds the turn");
  assert.match(read("lib/local-setup.ts"), /if \(!localDbDir\(\)( \|\| isLocked\(\))?\) return false/, "a hosted copy never offers it");
  assert.match(read("app/setup/page.tsx"), /if \(!localDbDir\(\)\) notFound\(\)/);
});

test("the proxy lets the set-up through, the login page leads to it, and instrumentation loads the secrets before the first request", () => {
  assert.match(read("proxy.ts"), /"\/setup", "\/api\/setup"/);
  assert.match(read("app/login/layout.tsx"), /if \(await needsSetup\(\)\) redirect\("\/setup"\)/);
  const inst = read("instrumentation.ts");
  assert.ok(inst.includes('NEXT_RUNTIME === "nodejs"') && inst.includes('import("./instrumentation-node")'));
  assert.doesNotMatch(inst, /process\.(exit|once)\(/, "Node.js-only calls stay out of the file Next.js also compiles for the Edge runtime");
  assert.ok(read("instrumentation-node.ts").includes("ensureLocalSecrets"));
});
