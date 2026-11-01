// Checks on seeding the shared reference data into a fresh local folder (open item ED9, slice 1). Runs a real PGlite folder: about five seconds. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ARCHETYPES } from "../lib/archetypes-data";
import { BUNDLE_FORMAT, chunks, parseBundle } from "../lib/local-seed-core";
import { makeLocalPool } from "../lib/local-db";

const slugs = new Set(ARCHETYPES.map((a) => a.slug));
const slug = ARCHETYPES[0].slug;
const goodBundle = {
  format: BUNDLE_FORMAT, version: 1,
  concepts: [{ name: "dawn", display_name: "Dawn", description: "A beginning." }, { name: "dusk", display_name: "Dusk", description: null }],
  card_concepts: [{ card_id: "major-0", concept: "dawn", reversed: false }, { card_id: "major-0", concept: "dusk", reversed: true }],
  concept_archetypes: [{ concept: "dawn", slug, aspect: "light", primary: true }],
};

test("a bundle is read and checked: every wrong row is named, and nothing half-valid is returned", () => {
  const ok = parseBundle(JSON.stringify(goodBundle), slugs);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.bundle?.concepts.length, 2);
  assert.equal(ok.bundle?.concepts[1].description, null);
  assert.match(parseBundle("not json", slugs).problems[0], /not valid JSON/);
  assert.match(parseBundle(JSON.stringify({ ...goodBundle, version: 2 }), slugs).problems[0], /version 1/);
  const bad = parseBundle(JSON.stringify({
    ...goodBundle,
    card_concepts: [{ card_id: "major-0", concept: "nobody", reversed: false }],
    concept_archetypes: [{ concept: "dawn", slug: "not-an-archetype", aspect: "light", primary: true }, { concept: "dawn", slug, aspect: "loud", primary: false }],
    concepts: [...goodBundle.concepts, { name: "dawn", display_name: "Again", description: null }],
  }), slugs);
  assert.equal(bad.bundle, null);
  assert.equal(bad.problems.length, 4);
  const twoPrimaries = parseBundle(JSON.stringify({ ...goodBundle, concept_archetypes: [{ concept: "dawn", slug, aspect: "light", primary: true }, { concept: "dawn", slug: ARCHETYPES[1].slug, aspect: "light", primary: true }] }), slugs);
  assert.match(twoPrimaries.problems[0], /2 primary/);
});

test("chunks splits a list without losing or repeating anything", () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunks([], 3), []);
});

test("a fresh local folder gets the archetypes, the tools' links and the bundle; a second start changes nothing and keeps a later edit", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "seed-"));
  const bundleFile = path.join(dir, "bundle.json");
  writeFileSync(bundleFile, JSON.stringify(goodBundle));
  process.env.DS_REFERENCE_BUNDLE = bundleFile;
  const count = async (pool: ReturnType<typeof makeLocalPool>, sql: string) => {
    const c = await pool.connect();
    try { return Number(((await c.query(sql)).rows[0] as { n: string }).n); } finally { c.release(); }
  };
  try {
    const first = makeLocalPool(path.join(dir, "data"));
    assert.equal(await count(first, "SELECT COUNT(*) AS n FROM archetypes"), ARCHETYPES.length);
    const links = await count(first, "SELECT COUNT(*) AS n FROM symbol_archetypes");
    assert.ok(links > 150, `the runes, ogham, dice, pendulum and scrying links are there (${links})`);
    assert.ok(await count(first, "SELECT COUNT(*) AS n FROM symbol_notes") > 0);
    assert.equal(await count(first, "SELECT COUNT(*) AS n FROM symbol_archetypes WHERE symbol_id LIKE 'major-%'"), 0, "the tarot file waits for review and is not seeded");
    assert.equal(await count(first, "SELECT COUNT(*) AS n FROM concepts"), 2);
    assert.equal(await count(first, "SELECT COUNT(*) AS n FROM card_concepts WHERE reversed"), 1);
    assert.equal(await count(first, "SELECT COUNT(*) AS n FROM concept_archetypes WHERE is_primary"), 1);
    // A later edit of a piece's link, and a concept the person's copy gained, must survive the next start.
    const c = await first.connect();
    await c.query("UPDATE symbol_archetypes SET aspect = 'shadow' WHERE symbol_id = (SELECT symbol_id FROM symbol_archetypes WHERE is_primary LIMIT 1) AND is_primary");
    await c.query("DELETE FROM concepts WHERE name = 'dusk'");
    c.release();
    const shadowBefore = await count(first, "SELECT COUNT(*) AS n FROM symbol_archetypes WHERE aspect = 'shadow'");
    await first.end();

    const second = makeLocalPool(path.join(dir, "data"));
    assert.equal(await count(second, "SELECT COUNT(*) AS n FROM archetypes"), ARCHETYPES.length);
    assert.equal(await count(second, "SELECT COUNT(*) AS n FROM symbol_archetypes"), links);
    assert.equal(await count(second, "SELECT COUNT(*) AS n FROM symbol_archetypes WHERE aspect = 'shadow'"), shadowBefore, "an edited link is not overwritten");
    assert.equal(await count(second, "SELECT COUNT(*) AS n FROM concepts"), 1, "a folder that already has concepts is not given the bundle again");
    await second.end();
  } finally {
    delete process.env.DS_REFERENCE_BUNDLE;
  }
});

test("a bundle that does not hold up is reported and the rest is still seeded", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "seed-bad-"));
  const bundleFile = path.join(dir, "bundle.json");
  writeFileSync(bundleFile, JSON.stringify({ ...goodBundle, concept_archetypes: [{ concept: "dawn", slug: "nope", aspect: "light", primary: true }] }));
  process.env.DS_REFERENCE_BUNDLE = bundleFile;
  try {
    const pool = makeLocalPool(path.join(dir, "data"));
    const c = await pool.connect();
    try {
      assert.equal(Number(((await c.query("SELECT COUNT(*) AS n FROM archetypes")).rows[0] as { n: string }).n), ARCHETYPES.length);
      assert.equal(Number(((await c.query("SELECT COUNT(*) AS n FROM concepts")).rows[0] as { n: string }).n), 0, "nothing from a bad bundle is loaded");
    } finally { c.release(); }
    await pool.end();
  } finally {
    delete process.env.DS_REFERENCE_BUNDLE;
  }
});
