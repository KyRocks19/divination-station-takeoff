// Checks on what a copy that runs on one person's computer does not have (open item ED9, slice 5). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { LOCAL_HIDDEN_PREFIXES, hiddenIn, hiddenInLocal } from "../lib/edition-features";
import { NAV_GROUPS, groupsFor } from "../lib/nav-groups";
import { searchStatic } from "../lib/search-core";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("whole path segments are matched: /forum and what is under it, not /forums", () => {
  for (const p of ["/forum", "/forum/12", "/forum/reports", "/api/forum/3/report", "/circle", "/api/circles/4/join", "/join", "/api/auth/join", "/feedback", "/api/feedback/2", "/admin/users", "/api/admin/users/3", "/api/admin/invites/5", "/api/admin/forum-reports"]) {
    assert.ok(hiddenInLocal(p), p);
  }
  for (const p of ["/", "/forums", "/circles-of-stone", "/readings", "/settings", "/admin/log", "/admin/workers", "/api/worker/hello", "/api/auth/login", "/setup", "/api/local/backups", "/api/admin/workers/2", "/runes/set"]) {
    assert.ok(!hiddenInLocal(p), p);
  }
});

test("a hosted copy hides nothing", () => {
  for (const p of LOCAL_HIDDEN_PREFIXES) assert.equal(hiddenIn(undefined, p), false);
  assert.equal(hiddenIn("hosted", "/forum"), false);
  assert.equal(hiddenIn("local", "/forum"), true);
  assert.equal(hiddenIn(" LOCAL ", "/forum"), true);
});

test("every navigation link marked as needing a shared server is one a local copy refuses, and none of the others is", () => {
  const marked = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.serverOnly);
  assert.deepEqual(marked.map((i) => i.id).sort(), ["circle", "feedback", "forum", "letters", "reports", "users"]);
  for (const i of NAV_GROUPS.flatMap((g) => g.items)) {
    if (!i.href) continue;
    assert.equal(hiddenInLocal(i.href), !!i.serverOnly, `${i.id} ${i.href}`);
  }
});

test("the local navigation has no forum, circle, feedback or user links; the hosted one is as it was", () => {
  const ids = (admin: boolean, edition: "hosted" | "local") => groupsFor(admin, edition).flatMap((g) => g.items.map((i) => i.id));
  const local = ids(true, "local");
  for (const gone of ["forum", "circle", "feedback", "users", "reports"]) assert.ok(!local.includes(gone), gone);
  for (const kept of ["readings", "library", "guide", "about", "workers", "adminlog", "tool-tarot"]) assert.ok(local.includes(kept), kept);
  for (const there of ["forum", "circle", "feedback", "users", "reports"]) assert.ok(ids(true, "hosted").includes(there), there);
  assert.deepEqual(groupsFor(true), groupsFor(true, "hosted"), "the default is the hosted copy");
});

test("search offers the pages of a local copy only: no Forum or Your circle there", () => {
  const labels = (edition: "hosted" | "local") => searchStatic("forum", true, edition).flatMap((g) => g.items.map((i) => i.label));
  assert.ok(labels("hosted").includes("Forum"));
  assert.ok(!labels("local").includes("Forum"));
  const circle = (edition: "hosted" | "local") => searchStatic("circle", true, edition).flatMap((g) => g.items.map((i) => i.label));
  assert.ok(circle("hosted").includes("Your circle") && !circle("local").includes("Your circle"));
});

test("every top-level page or API folder for these features is covered, so a new route under them cannot slip through", () => {
  const dirs = (rel: string) => readdirSync(path.join(root, rel));
  for (const d of ["forum", "circle", "join", "feedback"]) assert.ok(dirs("app").includes(d) && hiddenInLocal(`/${d}`), d);
  for (const d of ["forum", "circles", "feedback"]) assert.ok(dirs("app/api").includes(d) && hiddenInLocal(`/api/${d}`), d);
  for (const d of dirs("app/api/admin")) {
    // Only the picture computers stay: a person's own studio uses them.
    assert.equal(hiddenInLocal(`/api/admin/${d}`), d !== "workers", `/api/admin/${d}`);
  }
});

test("the proxy answers not found before it does anything else with a hidden path, for pages and for the API", () => {
  const proxy = read("proxy.ts");
  assert.ok(proxy.includes("hiddenIn(process.env.DS_EDITION, pathname)"));
  assert.ok(proxy.indexOf("hiddenIn(") < proxy.indexOf("bodyTooBig(pathname"), "before any body is read");
  assert.ok(proxy.indexOf("hiddenIn(") > proxy.indexOf("originAllowed("), "after the host and origin checks");
});

test("the login page offers the invite link on a hosted copy and on a leader's copy in host mode, never on a copy for one person", () => {
  assert.match(read("app/login/page.tsx"), /showJoin=\{shapeOf\(\) !== "local"\}/);
  assert.match(read("components/LoginForm.tsx"), /\{showJoin && \(/);
});

test("the login form is friendly to password managers and autofill", () => {
  const login = read("components/LoginForm.tsx");
  assert.match(login, /name="username"/);
  assert.match(login, /autoComplete="username"/);
  assert.match(login, /name="password"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /new FormData\(e\.currentTarget\)/);
  assert.match(login, /disabled=\{loading\}/);
  assert.doesNotMatch(login, /disabled=\{loading \|\| !username \|\| !password\}/);
});
