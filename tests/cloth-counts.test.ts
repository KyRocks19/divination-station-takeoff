// Checks on the cloth counts in Patterns: per cloth, across cloths, and following the tools shown. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tallyAcrossCloths, tallyByCloth, type ClothCountRow } from "../lib/cloth-core";

const row = (cloth_id: number | null, cloth_name: string, kind: string, zone: string | null, n: number, where_kind: "zone" | "none" | "off" = "zone"): ClothCountRow => ({
  cloth_id, cloth_name, kind, where_kind, zone_name: zone, n,
});

const rows: ClothCountRow[] = [
  row(1, "Round cloth", "runes", "Inner ring", 3),
  row(1, "Round cloth", "dice", "Inner ring", 2),
  row(1, "Round cloth", "runes", null, 1, "off"),
  row(2, "Square cloth", "runes", "inner ring", 4),
  row(2, "Square cloth", "runes", "Left", 1),
  row(null, "Deleted cloth", "ogham", "Middle", 2),
];

test("each cloth gets its own counts, most first", () => {
  const t = tallyByCloth(rows, null);
  assert.deepEqual(t.map((c) => [c.name, c.total]), [["Round cloth", 6], ["Square cloth", 5], ["Deleted cloth", 2]]);
  assert.deepEqual(t[0].rows.map((r) => [r.label, r.n]), [["Inner ring", 5], ["Off the cloth", 1]]);
});

test("a cloth that was deleted keeps the name it was recorded with and is listed on its own", () => {
  const t = tallyByCloth(rows, null);
  assert.equal(t[2].key, "gone-Deleted cloth");
});

test("tools that are not shown are left out, and a cloth with nothing left is not listed", () => {
  const t = tallyByCloth(rows, ["dice"]);
  assert.deepEqual(t.map((c) => [c.name, c.total]), [["Round cloth", 2]]);
  assert.deepEqual(tallyByCloth(rows, []), []);
});

test("across cloths, zones with one name (ignoring capitals) are added and the cloths are counted", () => {
  const a = tallyAcrossCloths(rows, null);
  const inner = a.find((r) => r.label.toLowerCase() === "inner ring")!;
  assert.equal(inner.n, 9);
  assert.equal(inner.cloths, 2);
  assert.equal(a[0], inner);
  assert.equal(a.find((r) => r.label === "Off the cloth")?.n, 1);
});

test("the counts carry no words of their own beyond where something landed", () => {
  const labels = new Set(tallyAcrossCloths(rows, null).map((r) => r.label));
  for (const l of labels) assert.ok(["Inner ring", "inner ring", "Left", "Middle", "Off the cloth", "On the cloth, in no zone"].includes(l), l);
});
