// Checks on host mode: a local copy that also serves the circle of the person who runs it (docs/plan-host-mode.md, slice H2.1). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HOST_CIRCLE_MEMBERS, HOST_CIRCLE_MEMBERS_LIMIT, hostCircleMembers, isHostMode, shapeOf } from "../lib/edition";
import { HOST_HIDDEN_PREFIXES, LOCAL_HIDDEN_PREFIXES, hiddenIn, hiddenInHost } from "../lib/edition-features";
import { groupsFor } from "../lib/nav-groups";
import { searchStatic } from "../lib/search-core";
import { MAX_CIRCLE_MEMBERS, circleMayMakeAccount } from "../lib/circles-core";
import { maxCircleMembers } from "../lib/circle-limits";
import { allowedHostNames, hostAllowed } from "../lib/host-guard";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("host mode exists only on a local copy; a hosted copy ignores DS_MODE", () => {
  assert.equal(isHostMode("host", "local"), true);
  assert.equal(isHostMode(" HOST ", " Local "), true);
  assert.equal(isHostMode("host", undefined), false);
  assert.equal(isHostMode("host", "hosted"), false);
  assert.equal(isHostMode(undefined, "local"), false);
  assert.equal(isHostMode("single", "local"), false);
  assert.equal(shapeOf(undefined, undefined), "hosted");
  assert.equal(shapeOf(undefined, "host"), "hosted");
  assert.equal(shapeOf("local", undefined), "local");
  assert.equal(shapeOf("local", "host"), "host");
});

test("a local copy for one person still hides what it did before; host mode keeps the circle pages and hides only feedback", () => {
  for (const p of LOCAL_HIDDEN_PREFIXES) assert.equal(hiddenIn("local", p, undefined), true, p);
  for (const p of ["/forum", "/forum/3", "/circle", "/api/circles/2", "/join", "/api/auth/join", "/admin/users", "/api/admin/invites/1", "/api/admin/forum-reports"]) {
    assert.equal(hiddenIn("local", p, "host"), false, p);
  }
  for (const p of ["/feedback", "/api/feedback", "/api/feedback/9"]) assert.equal(hiddenIn("local", p, "host"), true, p);
  assert.deepEqual([...HOST_HIDDEN_PREFIXES], ["/feedback", "/api/feedback"]);
  assert.equal(hiddenInHost("/feedbacks"), false);
  // A hosted copy hides nothing, whatever DS_MODE says.
  for (const p of [...LOCAL_HIDDEN_PREFIXES, ...HOST_HIDDEN_PREFIXES]) assert.equal(hiddenIn("hosted", p, "host"), false, p);
});

test("the navigation of a leader's copy has the forum, circle, users and reports links but not feedback", () => {
  const ids = (edition: "hosted" | "local" | "host") => groupsFor(true, edition).flatMap((g) => g.items.map((i) => i.id));
  for (const there of ["forum", "circle", "users", "reports"]) assert.ok(ids("host").includes(there), there);
  assert.ok(!ids("host").includes("feedback"));
  assert.ok(ids("hosted").includes("feedback"));
  for (const gone of ["forum", "circle", "feedback", "users", "reports"]) assert.ok(!ids("local").includes(gone), gone);
});

test("search on a leader's copy offers the Forum page", () => {
  const labels = (edition: "hosted" | "local" | "host") => searchStatic("forum", true, edition).flatMap((g) => g.items.map((i) => i.label));
  assert.ok(labels("host").includes("Forum"));
  assert.ok(!labels("local").includes("Forum"));
});

test("Host a circle is offered to the admin of a copy on their own computer, never on a hosted copy", () => {
  const ids = (admin: boolean, edition: "hosted" | "local" | "host") => groupsFor(admin, edition).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(ids(true, "local").includes("host"));
  assert.ok(ids(true, "host").includes("host"));
  assert.ok(!ids(true, "hosted").includes("host"));
  assert.ok(!ids(false, "host").includes("host"));
  const labels = (edition: "hosted" | "local" | "host") => searchStatic("host a circle", true, edition).flatMap((g) => g.items.map((i) => i.label));
  assert.ok(labels("local").includes("Host a circle"));
  assert.ok(!labels("hosted").includes("Host a circle"));
  assert.ok(!searchStatic("feedback", true, "host").flatMap((g) => g.items.map((i) => i.label)).includes("Feedback"), "search follows the nav's noHost too");
});

test("a leader's circle holds 10 people and its codes may make 20 accounts; a hosted circle is as before", () => {
  assert.equal(HOST_CIRCLE_MEMBERS, 10);
  assert.equal(maxCircleMembers(true), 10);
  assert.equal(maxCircleMembers(false), MAX_CIRCLE_MEMBERS);
  assert.equal(MAX_CIRCLE_MEMBERS, 30);
  assert.equal(circleMayMakeAccount(19, 10), true);
  assert.equal(circleMayMakeAccount(20, 10), false);
  assert.equal(circleMayMakeAccount(59), true);
  assert.equal(circleMayMakeAccount(60), false);
});

test("host mode does not open the host guard: a local copy still answers only to the names it is given", () => {
  const names = allowedHostNames("local", "friend-pc.tail1234.ts.net");
  assert.ok(names);
  assert.equal(hostAllowed("friend-pc.tail1234.ts.net", names), true);
  assert.equal(hostAllowed("localhost:47831", names), true);
  assert.equal(hostAllowed("evil.example", names), false);
  assert.equal(hostAllowed("other.tail1234.ts.net", names), false);
});

test("the browser file for the Circle page does not read the environment: it is told the cap by the server", () => {
  const panel = read("components/CirclePanel.tsx");
  assert.ok(!/maxCircleMembers|isHostMode|process\.env/.test(panel));
  assert.ok(panel.includes("c.max_members"));
  assert.ok(read("lib/circles.ts").includes("max_members: maxCircleMembers()"));
});

test("the proxy asks hiddenIn, and the setup route still refuses a name that is not this computer", () => {
  assert.ok(read("proxy.ts").includes("hiddenIn(process.env.DS_EDITION, pathname)"));
  const setup = read("app/api/setup/route.ts");
  assert.ok(setup.includes("reachedOnThisComputer"));
});

test("a host may set the circle size from 2 to 30 with DS_HOST_CIRCLE_MAX; anything else keeps 10", () => {
  assert.equal(HOST_CIRCLE_MEMBERS_LIMIT, MAX_CIRCLE_MEMBERS);
  assert.equal(hostCircleMembers(undefined), 10);
  assert.equal(hostCircleMembers("6"), 6);
  assert.equal(hostCircleMembers(" 30 "), 30);
  for (const bad of ["", "1", "31", "12.5", "many", "-4"]) assert.equal(hostCircleMembers(bad), 10, bad);
});
