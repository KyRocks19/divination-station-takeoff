// Checks on moving a circle's forum between hosts: reading the file, planning what is added, and the guards on the route. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BUNDLE_FORMAT, BUNDLE_LIMITS, bundleFileName, checkBundle, planImport, shownAuthor, type LocalForum } from "../lib/forum-bundle-core";

const comment = (id: string, username = "sam") => ({ id, author: username.toUpperCase(), username, content: "Nice.", written_at: "2026-10-20T10:00:00.000Z" });
const post = (id: string, comments: ReturnType<typeof comment>[] = [], username = "sam") => ({
  id, author: username.toUpperCase(), username, title: "A reading", body: "Words.", written_at: "2026-10-19T10:00:00.000Z", comments,
});
const file = (posts: unknown[]) => ({ format: BUNDLE_FORMAT, version: 1, exported_at: "2026-10-27T00:00:00.000Z", circle_name: "House", posts });
const empty = (): LocalForum => ({ posts: new Map(), comments: new Set(), members: new Map([["sam", 7]]) });

function ok(raw: unknown) {
  const r = checkBundle(raw);
  assert.ok(r.ok);
  return r.ok ? r : (null as never);
}

test("a file that is not a forum bundle is refused in plain words", () => {
  for (const raw of [null, "x", {}, { format: "other", version: 1, posts: [] }]) {
    const r = checkBundle(raw);
    assert.ok(!r.ok);
    if (!r.ok) assert.match(r.error, /not a forum file/);
  }
  const newer = checkBundle({ format: BUNDLE_FORMAT, version: 2, posts: [] });
  assert.ok(!newer.ok && /newer version/.test(newer.error));
});

test("too many posts are refused, unreadable rows are counted and left out", () => {
  const many = checkBundle(file(Array.from({ length: BUNDLE_LIMITS.posts + 1 }, (_, i) => post(`id-${String(i).padStart(8, "0")}`))));
  assert.ok(!many.ok);
  const r = ok(file([post("aaaaaaaa-1"), { id: "x" }, post("aaaaaaaa-1"), post("bbbbbbbb-2", [comment("cccccccc-3"), { id: "no" } as unknown as ReturnType<typeof comment>])]));
  assert.equal(r.bundle.posts.length, 2);
  assert.equal(r.leftOut.posts, 2);
  assert.equal(r.leftOut.comments, 1);
});

test("text is length-limited and dates must be real", () => {
  const long = { ...post("aaaaaaaa-1"), body: "x".repeat(BUNDLE_LIMITS.body + 1) };
  const badDate = { ...post("bbbbbbbb-2"), written_at: "not a date" };
  const r = ok(file([long, badDate, post("cccccccc-3")]));
  assert.deepEqual(r.bundle.posts.map((p) => p.id), ["cccccccc-3"]);
  assert.equal(r.leftOut.posts, 2);
});

test("a new post is added under the member whose username matches, and an unknown writer is kept under the importer with their name", () => {
  const r = ok(file([post("aaaaaaaa-1", [comment("cccccccc-1", "SAM"), comment("cccccccc-2", "nobody")])]));
  const plan = planImport(r.bundle, empty(), 1, r.leftOut);
  assert.equal(plan.newPosts[0].userId, 7);
  assert.equal(plan.newPosts[0].originAuthor, null);
  assert.deepEqual(plan.newPosts[0].comments.map((c) => [c.userId, c.originAuthor]), [[7, null], [1, "NOBODY"]]);
  assert.deepEqual(plan.counts, { posts_add: 1, posts_have: 0, comments_add: 2, comments_have: 0, matched_authors: 2, unmatched_authors: 1, left_out: 0 });
});

test("importing the same file again adds nothing", () => {
  const r = ok(file([post("aaaaaaaa-1", [comment("cccccccc-1")])]));
  const local = empty();
  local.posts.set("aaaaaaaa-1", { id: 40, inThisCircle: true });
  local.comments.add("cccccccc-1");
  const plan = planImport(r.bundle, local, 1, r.leftOut);
  assert.equal(plan.newPosts.length, 0);
  assert.equal(plan.additions.length, 0);
  assert.equal(plan.counts.posts_have, 1);
  assert.equal(plan.counts.comments_have, 1);
  assert.equal(plan.counts.posts_add + plan.counts.comments_add, 0);
});

test("a new comment on a post that is already here is added to that post", () => {
  const r = ok(file([post("aaaaaaaa-1", [comment("cccccccc-1"), comment("cccccccc-2")])]));
  const local = empty();
  local.posts.set("aaaaaaaa-1", { id: 40, inThisCircle: true });
  local.comments.add("cccccccc-1");
  const plan = planImport(r.bundle, local, 1, r.leftOut);
  assert.equal(plan.additions.length, 1);
  assert.equal(plan.additions[0].postId, 40);
  assert.deepEqual(plan.additions[0].comments.map((c) => c.bundle.id), ["cccccccc-2"]);
  assert.equal(plan.counts.comments_add, 1);
});

test("nothing is added to a post that lives in another circle of this copy", () => {
  const r = ok(file([post("aaaaaaaa-1", [comment("cccccccc-2")])]));
  const local = empty();
  local.posts.set("aaaaaaaa-1", { id: 40, inThisCircle: false });
  const plan = planImport(r.bundle, local, 1, r.leftOut);
  assert.equal(plan.additions.length, 0);
  assert.equal(plan.counts.comments_add, 0);
  assert.equal(plan.counts.left_out, 1);
});

test("the shown name marks a post that came from another host", () => {
  assert.equal(shownAuthor({ origin_author: "Sam", display_name: "Kylie", username: "kylie" }), "Sam (from another host)");
  assert.equal(shownAuthor({ origin_author: null, display_name: "Kylie", username: "kylie" }), "Kylie");
  assert.equal(shownAuthor({ display_name: null, username: "kylie" }), "kylie");
});

test("the saved file is named after the circle and the day", () => {
  assert.equal(bundleFileName("The Coven's House!", new Date("2026-10-27T05:00:00Z")), "forum-the-coven-s-house-2026-10-27.json");
  assert.equal(bundleFileName("???", new Date("2026-10-27T05:00:00Z")), "forum-circle-2026-10-27.json");
});

test("the route is for administrators only, checks the sign-in itself, and only adds", () => {
  const src = readFileSync(path.join(__dirname, "..", "app", "api", "forum", "bundle", "route.ts"), "utf8");
  assert.equal((src.match(/if \(!session\.userId\)/g) ?? []).length, 2);
  assert.equal((src.match(/if \(!session\.isAdmin\)/g) ?? []).length, 2);
  const lib = readFileSync(path.join(__dirname, "..", "lib", "forum-bundle.ts"), "utf8");
  assert.ok(!/\b(UPDATE|DELETE)\b/.test(lib.replace(/\/\/.*$/gm, "").replace(/\*[^\n]*/g, "")), "an import never changes or deletes a row");
});

test("the migration gives every post and comment a unique id", () => {
  const sql = readFileSync(path.join(__dirname, "..", "migrations", "099_forum_bundle.sql"), "utf8");
  assert.match(sql, /forum_posts ADD COLUMN IF NOT EXISTS bundle_uid TEXT NOT NULL DEFAULT gen_random_uuid\(\)::text/);
  assert.match(sql, /forum_comments ADD COLUMN IF NOT EXISTS bundle_uid/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS forum_posts_bundle_uid/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS forum_comments_bundle_uid/);
});
