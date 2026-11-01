import { test } from "node:test";
import assert from "node:assert/strict";
import { applicableChecks, scanForSecrets, scanHistoryPatch } from "../lib/changed-checks-core";

const names = (files: string[], client: string[] = []) =>
  applicableChecks(files, new Set(client)).map((c) => c.check);

test("a docs-only change asks for nothing but the notes sync when notes changed", () => {
  assert.deepEqual(names(["docs/plan-host-mode.md"]), []);
  assert.deepEqual(names(["docs/open-items.md"]), ["open-item-sync quick"]);
});

test("a migration asks for the data lifecycle check", () => {
  assert.deepEqual(names(["migrations/091_x.sql"]), ["data-lifecycle-check"]);
});

test("a component asks for design, accessibility, client and wording checks", () => {
  const got = names(["components/Foo.tsx"], ["components/Foo.tsx"]);
  assert.ok(got.includes("design-system-check + accessibility-pass"));
  assert.ok(got.includes("client-safety-check"));
  assert.ok(got.includes("copy-check"));
});

test("a route asks for the route conventions; the companion asks for the privacy audit", () => {
  assert.ok(names(["app/api/foo/route.ts"]).includes("new-api-route + next16-docs"));
  assert.ok(names(["lib/companion-own.ts"]).includes("companion-privacy-audit"));
  assert.ok(names(["lib/patterns-symbols.ts"]).includes("companion-privacy-audit"));
});

test("meaning data asks for the ritual-source rules", () => {
  assert.ok(names(["lib/runes-data.ts"]).includes("write-ritual-source"));
  assert.ok(names(["data/symbol-archetypes-runes.txt"]).includes("write-ritual-source"));
});

test("secret scan finds keys and risky names, and passes ordinary text", () => {
  assert.equal(scanForSecrets(["const a = 1;", "see sk-ant-" + "x".repeat(20)], []).length, 1);
  assert.equal(scanForSecrets(["DATABASE_URL=postgresql" + "://u:pw@host/db"], []).length, 1);
  assert.equal(scanForSecrets([], [".env.local", "notes.swp", ".env.example"]).length, 2);
  assert.equal(scanForSecrets(["SESSION_SECRET=<any 32+ chars>"], []).length, 0);
});

test("history scan names the commit and file, never the value, and skips known examples", () => {
  const key = "sk-ant-" + "q".repeat(24);
  const patch = [
    "commit:aaa111",
    "+++ b/docs/notes.md",
    `+ my key ${key}`,
    "+ host my-pc.tail1234.ts.net",
    "+ host " + "real-pc.tailabcd" + ".ts.net",
    "commit:bbb222",
    "+++ b/.env.local",
    "+DATABASE_URL=postgresql" + "://u:p@localhost/db",
    "+++ b/tests/x.test.ts",
    '+ seal("sk-ant-api03-abcdef")',
  ].join("\n");
  const found = scanHistoryPatch(patch);
  assert.deepEqual(
    found.map((f) => `${f.kind} ${f.label} ${f.commit} ${f.path}`),
    [
      "secret Anthropic key aaa111 docs/notes.md",
      "personal tailnet hostname aaa111 docs/notes.md",
      "secret risky file name bbb222 .env.local",
    ],
  );
  assert.ok(!JSON.stringify(found).includes(key));
});
