// Checks on gallery tags: tidying what is typed, counting, and filtering. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MAX_TAGS_PER_PICTURE, MAX_TAG_LENGTH, cleanTags, filterByTag, matchesFilter, tagCounts, tagsToText, tooManyTags } from "../lib/gallery-tags-core";

test("typed text is split on commas, semicolons and new lines, and tidied", () => {
  assert.deepEqual(cleanTags("  moon ,  Cups;\n  big   sky  ,, "), ["moon", "Cups", "big sky"]);
});

test("repeats are dropped whatever their capitals, and the first spelling stays", () => {
  assert.deepEqual(cleanTags(["Moon", "moon", "MOON", "sun"]), ["Moon", "sun"]);
});

test("a tag is cut to its length and a picture keeps only so many", () => {
  assert.equal(cleanTags("x".repeat(80))[0].length, MAX_TAG_LENGTH);
  const many = cleanTags(Array.from({ length: 20 }, (_, i) => `t${i}`));
  assert.equal(many.length, MAX_TAGS_PER_PICTURE);
  assert.ok(tooManyTags(Array.from({ length: 12 }, (_, i) => `t${i}`).join(",")));
  assert.ok(!tooManyTags("a, b, A"));
});

test("anything that is not text or a list of text gives no tags", () => {
  assert.deepEqual(cleanTags(undefined), []);
  assert.deepEqual(cleanTags(42), []);
  assert.deepEqual(cleanTags({ a: 1 }), []);
  assert.deepEqual(cleanTags([1, null, "ok", {}]), ["ok"]);
});

test("tags round-trip through the editing line", () => {
  const tags = ["moon", "big sky", "2026"];
  assert.deepEqual(cleanTags(tagsToText(tags)), tags);
});

test("counts add up over the pictures, ignoring capitals, A to Z", () => {
  const c = tagCounts([{ tags: ["Moon", "cups"] }, { tags: ["moon"] }, { tags: [] }, {}, { tags: ["Moon"] }]);
  assert.deepEqual(c.map((t) => [t.key, t.label, t.n]), [["cups", "cups", 1], ["moon", "Moon", 3]]);
});

test("filters: all, untagged, and one tag", () => {
  const items = [{ id: 1, tags: ["Moon"] }, { id: 2, tags: [] }, { id: 3 }, { id: 4, tags: ["sun", "moon"] }];
  assert.deepEqual(filterByTag(items, { kind: "all" }).map((i) => i.id), [1, 2, 3, 4]);
  assert.deepEqual(filterByTag(items, { kind: "untagged" }).map((i) => i.id), [2, 3]);
  assert.deepEqual(filterByTag(items, { kind: "tag", key: "moon" }).map((i) => i.id), [1, 4]);
  assert.ok(!matchesFilter(undefined, { kind: "tag", key: "moon" }));
});

test("lib/gallery-tags-core.ts imports nothing", () => {
  const src = readFileSync(path.join(__dirname, "..", "lib", "gallery-tags-core.ts"), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]), []);
});

test("migration 088 adds the column idempotently and nothing else", () => {
  const files = readdirSync(path.join(__dirname, "..", "migrations")).filter((f) => f.startsWith("088_"));
  assert.equal(files.length, 1);
  const sql = readFileSync(path.join(__dirname, "..", "migrations", files[0]), "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /ALTER TABLE oracle_gallery ADD COLUMN IF NOT EXISTS tags TEXT\[\] NOT NULL DEFAULT '\{\}'/);
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE/i);
});
