import { test } from "node:test";
import assert from "node:assert/strict";
import { canModerate, canPost, canSeePost, hideThreshold, listScope, type ForumViewer } from "../lib/forum-circles-core";
import { existsSync, readFileSync } from "node:fs";
import { shouldHide } from "../lib/forum-reports";

const viewer = (over: Partial<ForumViewer> = {}): ForumViewer => ({ userId: 1, isAdmin: false, circleId: 10, isLeader: false, ...over });

test("a post is read by members of its circle, its author and the owner of the app, and by nobody else", () => {
  const post = { user_id: 2, circle_id: 10 };
  assert.equal(canSeePost(viewer(), post), true);
  assert.equal(canSeePost(viewer({ circleId: 11 }), post), false);
  assert.equal(canSeePost(viewer({ circleId: null }), post), false);
  assert.equal(canSeePost(viewer({ circleId: null, userId: 2 }), post), true);
  assert.equal(canSeePost(viewer({ circleId: 11, isAdmin: true }), post), true);
});

test("a post with no circle is private to its author (and the owner)", () => {
  const post = { user_id: 2, circle_id: null };
  assert.equal(canSeePost(viewer(), post), false);
  assert.equal(canSeePost(viewer({ circleId: null }), post), false);
  assert.equal(canSeePost(viewer({ userId: 2, circleId: null }), post), true);
});

test("writing needs a circle", () => {
  assert.equal(canPost(viewer()), true);
  assert.equal(canPost(viewer({ circleId: null })), false);
});

test("the leader of the circle, and the owner of the app, may remove a post; a member of the circle may not", () => {
  const post = { user_id: 2, circle_id: 10 };
  assert.equal(canModerate(viewer({ isLeader: true }), post), true);
  assert.equal(canModerate(viewer(), post), false);
  assert.equal(canModerate(viewer({ isLeader: true, circleId: 11 }), post), false);
  assert.equal(canModerate(viewer({ isLeader: true, circleId: 11, isAdmin: true }), post), true);
  assert.equal(canModerate(viewer({ isLeader: true, circleId: null }), { user_id: 2, circle_id: null }), false);
});

test("the number of reporters that hides something follows the size of the circle, and can always be reached", () => {
  assert.equal(hideThreshold(1), 2);
  assert.equal(hideThreshold(4), 2);
  assert.equal(hideThreshold(9), 3);
  assert.equal(hideThreshold(12), 3);
  assert.equal(hideThreshold(20), 5);
  assert.equal(hideThreshold(30), 5);
  assert.equal(hideThreshold(null), 5);
  // Reporters can be everyone except the author: the threshold must not exceed that for any circle of 3 or more.
  for (let n = 3; n <= 30; n++) assert.ok(hideThreshold(n) <= n - 1, `circle of ${n}`);
  assert.equal(shouldHide(2, hideThreshold(4)), true);
  assert.equal(shouldHide(1, hideThreshold(4)), false);
});

test("a list of posts holds the person's circle's posts and their own, and nothing from another circle", () => {
  const params: unknown[] = ["already here"];
  assert.equal(listScope(viewer({ userId: 7, circleId: 10 }), "fp", params), "(fp.circle_id = $3 OR fp.user_id = $2)");
  assert.deepEqual(params, ["already here", 7, 10]);
  // Without a circle a person sees only their own posts.
  const alone: unknown[] = [];
  assert.equal(listScope(viewer({ userId: 7, circleId: null }), "p", alone), "p.user_id = $1");
  assert.deepEqual(alone, [7]);
});

test("every forum list is limited by listScope, and a post copies only the poster's own reading", () => {
  for (const file of ["app/api/forum/route.ts", "app/forum/page.tsx"]) assert.match(readFileSync(file, "utf8"), /listScope\(viewer, "fp", params\)/, file);
  assert.equal(readFileSync("lib/search.ts", "utf8").match(/listScope\(await forumViewer\(userId, isAdmin\), "fp", params\)/g)?.length, 2);
  const post = readFileSync("app/api/forum/route.ts", "utf8");
  assert.match(post, /SELECT \* FROM readings WHERE id = \$1 AND user_id = \$2/);
  assert.doesNotMatch(post, /FROM readings WHERE id = \$1"/, "no reading is read by its id alone");
  assert.match(post, /att\.ref_id = toId\(att\.ref_id\)/);
});

test("only the author edits a post; the owner of the app can remove it but not rewrite it", () => {
  const route = readFileSync("app/api/forum/[id]/route.ts", "utf8");
  const put = route.slice(route.indexOf("export async function PUT"), route.indexOf("export async function DELETE"));
  assert.match(put, /if \(post\.user_id !== session\.userId\) \{/);
  assert.doesNotMatch(put, /isAdmin|canModerate/);
  assert.match(readFileSync("app/forum/[id]/page.tsx", "utf8"), /const canEdit = session\.userId === post\.user_id;/);
});

test("a sigil is private: no route or page reads anyone's sigil but the signed-in person's own", () => {
  assert.equal(existsSync("app/api/sigil/[userId]/route.ts"), false, "no lookup of another person's sigil");
  assert.doesNotMatch(readFileSync("app/forum/[id]/page.tsx", "utf8"), /sigil_data|SigilDisplay/);
  const own = readFileSync("app/api/sigil/route.ts", "utf8");
  assert.match(own, /SELECT sigil_data FROM users WHERE id = \$1",\s*\[session\.userId\]/);
});
