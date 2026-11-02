import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DIVINATION_SLUG, OWN_TAKE_MAX_LENGTH, TAKES, TONE_LABELS, TONE_ORDER, cleanOwnTake, homeOrder, isTakeId, keptMarkdown, nextTakeIndex,
  ownMarkdownLines, shapeKeptExport, shapeOwnExport, takeById, takeOrder, visibleTakes, nextVisibleIndex, shapeHiddenTakesExport,
  hiddenTakesMarkdown,
} from "../lib/divination-takes-core";
import { getArchetype } from "../lib/archetypes-data";

test("takes: unique ids, every kind has several, each is one short line", () => {
  const ids = TAKES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TAKES) {
    assert.match(t.id, /^[a-z0-9-]+$/, t.id);
    assert.ok(t.text.length > 10 && t.text.length <= 160, `${t.id} is one line`);
    assert.ok(!/\n/.test(t.text));
    assert.ok(t.id.startsWith(t.tone + "-"), `${t.id} starts with its kind`);
  }
  for (const tone of TONE_ORDER) {
    assert.ok(TAKES.filter((t) => t.tone === tone).length >= 8, `${tone} has at least eight takes`);
    assert.ok(TONE_LABELS[tone]);
  }
});

test("no take says psi or a tool is proven, and none speaks for the app with 'we'", () => {
  for (const t of TAKES) {
    assert.doesNotMatch(t.text, /\b(proven|proves?|scientific(ally)?|guarantee[sd]?)\b/i, t.id);
    assert.doesNotMatch(t.text, /\bwe\b/i, t.id);
  }
});

test("the order shows every take once before any repeats, and is the same for the same seed", () => {
  for (const seed of [0, 1, 42, 2147483645, -7]) {
    const order = takeOrder(seed);
    assert.equal(order.length, TAKES.length);
    assert.deepEqual([...order].sort((a, b) => a - b), TAKES.map((_, i) => i));
    assert.deepEqual(takeOrder(seed), order);
  }
  assert.notDeepEqual(takeOrder(1), takeOrder(2));
  assert.equal(nextTakeIndex(0, 3), 1);
  assert.equal(nextTakeIndex(2, 3), 0);
  assert.equal(nextTakeIndex(0, 1), 0);
});

test("only known takes are accepted, and the archetype they belong to exists", () => {
  assert.ok(isTakeId(TAKES[0].id));
  assert.ok(!isTakeId("nope"));
  assert.ok(!isTakeId(3));
  assert.equal(takeById(TAKES[1].id), TAKES[1]);
  assert.equal(getArchetype(DIVINATION_SLUG)?.name, "Divination");
});

test("the export holds the words of each kept take, not its id, and leaves out ids no longer known", () => {
  const data = shapeKeptExport([
    { take_id: "playful-overthinking", created_at: "2026-10-26T12:00:00Z" },
    { take_id: "gone-take", created_at: "2026-10-25T12:00:00Z" },
  ]);
  assert.deepEqual(data.kept_divination_takes, [{ text: "Overthinking, but with props.", kind: "Tongue in cheek", kept_on: "2026-10-26" }]);
  assert.deepEqual(keptMarkdown(data), ["", "## Takes on divination you kept", "", "- Overthinking, but with props. (Tongue in cheek, kept 2026-10-26)"]);
  assert.deepEqual(keptMarkdown({ kept_divination_takes: [] }), []);
});

test("kept takes are deleted with the account and every query is for one person", () => {
  assert.match(readFileSync("migrations/098_divination_takes.sql", "utf8"), /REFERENCES users\(id\) ON DELETE CASCADE/);
  const sql = readFileSync("lib/divination-takes.ts", "utf8");
  const queries = sql.match(/"(SELECT|INSERT|DELETE)[^"]*"/g) ?? [];
  assert.ok(queries.length >= 8);
  for (const q of queries) assert.match(q, /user_id = \$1|VALUES \(\$1/, q);
  assert.equal(readFileSync("migrations/098_divination_takes.sql", "utf8").match(/ON DELETE CASCADE/g)?.length, 2);
  assert.match(readFileSync("app/api/export/route.ts", "utf8"), /\.\.\.keptTakes,\s+\.\.\.ownTakes/);
});

test("an own take is one line of up to the limit", () => {
  assert.equal(cleanOwnTake("  A  question\nasked well. "), "A question asked well.");
  assert.equal(cleanOwnTake("   "), null);
  assert.equal(cleanOwnTake(42), null);
  assert.equal(cleanOwnTake("x".repeat(OWN_TAKE_MAX_LENGTH)), "x".repeat(OWN_TAKE_MAX_LENGTH));
  assert.equal(cleanOwnTake("x".repeat(OWN_TAKE_MAX_LENGTH + 1)), null);
});

test("the home order mixes the person's own takes into every third place, and shows every app take once", () => {
  assert.deepEqual(homeOrder(5, 4, 0).map((s) => s.own), [false, false, false, false]);
  for (const seed of [0, 1, 2, 99]) {
    const order = homeOrder(seed, TAKES.length, 2);
    const stock = order.filter((s) => !s.own).map((s) => s.i);
    assert.deepEqual([...stock].sort((a, b) => a - b), TAKES.map((_, i) => i), "every app take once");
    const own = order.filter((s) => s.own);
    assert.ok(own.length >= Math.floor(TAKES.length / 2) - 1, "own takes come round about one place in three");
    assert.ok(own.every((s) => s.i === 0 || s.i === 1));
    order.forEach((s, n) => assert.equal(s.own, (n + (seed % 3)) % 3 === 0));
  }
  const opensOnOwn = [0, 1, 2, 3, 4, 5].filter((seed) => homeOrder(seed, TAKES.length, 1)[0].own).length;
  assert.equal(opensOnOwn, 2, "one visit in three opens on one of their own");
});

test("the export holds the person's own takes in their words", () => {
  const data = shapeOwnExport([{ text: "A pause with pictures.", created_at: "2026-10-26T09:00:00Z" }]);
  assert.deepEqual(data, { own_divination_takes: [{ text: "A pause with pictures.", written_on: "2026-10-26" }] });
  assert.deepEqual(ownMarkdownLines(data), ["", "## Your own takes on divination", "", "- A pause with pictures. (written 2026-10-26)"]);
  assert.deepEqual(ownMarkdownLines({ own_divination_takes: [] }), []);
});

// ---------------------------------------------------------------- hidden takes (migration 105)

test("hidden takes are left out of the home page's pool, and unknown ids change nothing", () => {
  const hide = [TAKES[0].id, TAKES[5].id, "gone-take"];
  const left = visibleTakes(hide);
  assert.equal(left.length, TAKES.length - 2);
  assert.ok(!left.some((t) => t.id === TAKES[0].id || t.id === TAKES[5].id));
  assert.deepEqual(visibleTakes([]), [...TAKES]);
  assert.deepEqual(visibleTakes(TAKES.map((t) => t.id)), []);
});

test("with every app take hidden, the home page shows only the person's own; with nothing at all, nothing", () => {
  const order = homeOrder(7, 0, 3);
  assert.equal(order.length, 3);
  assert.ok(order.every((s) => s.own));
  assert.deepEqual([...order.map((s) => s.i)].sort(), [0, 1, 2]);
  assert.deepEqual(homeOrder(7, 0, 0), []);
});

test("after a hide, the next place skips every hidden one and wraps round; -1 when all are hidden", () => {
  const order = ["a", "b", "c", "d"];
  assert.equal(nextVisibleIndex(order, 0, (x) => x === "b"), 2);
  assert.equal(nextVisibleIndex(order, 2, (x) => x === "d" || x === "a"), 1);
  assert.equal(nextVisibleIndex(order, 1, (x) => x !== "b"), 1, "the only one left is the one it is on");
  assert.equal(nextVisibleIndex(order, 1, () => true), -1);
  assert.equal(nextVisibleIndex([], 0, () => false), -1);
});

test("hidden takes are exported with their words, and old ids are left out", () => {
  const data = shapeHiddenTakesExport([
    { take_id: "playful-overthinking", created_at: "2026-11-01T12:00:00Z" },
    { take_id: "gone-take", created_at: "2026-10-25T12:00:00Z" },
  ]);
  assert.deepEqual(data.hidden_divination_takes, [{ text: "Overthinking, but with props.", kind: "Tongue in cheek", hidden_on: "2026-11-01" }]);
  assert.deepEqual(hiddenTakesMarkdown(data), ["", "## Takes on divination you hid", "", "- Overthinking, but with props. (Tongue in cheek, hidden 2026-11-01)"]);
  assert.deepEqual(hiddenTakesMarkdown({ hidden_divination_takes: [] }), []);
  assert.match(readFileSync("app/api/export/route.ts", "utf8"), /\.\.\.ownTakes,\s+\.\.\.hiddenTakes/);
});

test("hidden takes are deleted with the account, and work before migration 105", () => {
  const sql = readFileSync("migrations/105_hidden_divination_takes.sql", "utf8");
  assert.match(sql, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /^-- older-versions: ok$/m);
  const lib = readFileSync("lib/divination-takes.ts", "utf8");
  for (const fn of ["hiddenTakeIds", "setTakeHidden", "hiddenTakesForExport"]) {
    const body = lib.slice(lib.indexOf(`export async function ${fn}`));
    assert.match(body.slice(0, body.indexOf("\n}\n")), /notThereYet\(err\)/, `${fn} treats a missing table as not there yet`);
  }
  // Keeping a hidden take shows it again, and hiding a kept take lets go of it, so a take is never both.
  assert.match(lib, /DELETE FROM user_hidden_divination_takes WHERE user_id = \$1 AND take_id = \$2/);
  const hideBody = lib.slice(lib.indexOf("export async function setTakeHidden"));
  assert.match(hideBody, /DELETE FROM user_divination_takes WHERE user_id = \$1 AND take_id = \$2/);
});
