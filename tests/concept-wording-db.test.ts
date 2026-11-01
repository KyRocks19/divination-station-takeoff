// Runs the concept wording (open item ED21, tiers 1 and 2) on a real PGlite folder seeded with every concept name in
// data/concept-archetypes-*.txt, the names the shared database holds. Checks that no new wording clashes with an existing name,
// that the old name is kept as a search word, that a second run changes nothing, and what each kind of person sees. About five seconds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BUNDLE_FORMAT } from "../lib/local-seed-core";
import { makeLocalPool } from "../lib/local-db";
import { CONCEPT_WORDING } from "../lib/concept-wording-data";
import { applyConceptWording } from "../lib/concept-wording";
import { visibleClause } from "../lib/concept-visibility";

/** Every concept name in the hand-sorted archetype files, without the light, shadow and neutral marks. */
function seededNames(): string[] {
  const names = new Set<string>();
  for (const f of readdirSync("data").filter((f) => f.startsWith("concept-archetypes-"))) {
    for (const line of readFileSync(path.join("data", f), "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.startsWith("#")) continue;
      const list = line.slice(line.indexOf("|") + 1);
      for (const raw of list.split(";")) {
        const name = raw.trim().replace(/[-~]$/, "").trim();
        if (name) names.add(name);
      }
    }
  }
  return [...names];
}

const display = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

test("the concept wording applies cleanly to the seeded names, keeps the old names, and is safe to run again", async () => {
  const fromFiles = seededNames();
  const names = fromFiles;
  const notInFiles = CONCEPT_WORDING.map((w) => w.name).filter((n) => !fromFiles.includes(n));
  assert.deepEqual(notInFiles, [], "every wording name is a seeded concept name");

  const dir = mkdtempSync(path.join(tmpdir(), "wording-"));
  const bundleFile = path.join(dir, "bundle.json");
  const bundle = {
    format: BUNDLE_FORMAT,
    version: 1,
    concepts: names.map((name) => ({ name, display_name: display(name), description: null })),
    card_concepts: [],
    concept_archetypes: [],
  };
  writeFileSync(bundleFile, JSON.stringify(bundle));
  process.env.DS_REFERENCE_BUNDLE = bundleFile;
  const pool = makeLocalPool(path.join(dir, "data"));
  try {
    const c = await pool.connect();
    const run = (sql: string, params: unknown[]) => c.query(sql, params as any[]) as Promise<{ rows: any[] }>;
    try {
      // The first start seeded the bundle and applied the wording; a second pass finds nothing left to do.
      const again = await applyConceptWording(run, false);
      assert.deepEqual(again.clashes, [], "no new wording is already another concept's name");
      assert.deepEqual(again.missing, []);
      assert.deepEqual(again.renamed, []);
      assert.deepEqual(again.marked, []);
      assert.equal(again.already, CONCEPT_WORDING.length);

      for (const w of CONCEPT_WORDING) {
        const row = (await run("SELECT display_name, sensitivity, aliases FROM concepts WHERE name = $1", [w.name])).rows[0];
        if (w.shownAs) {
          assert.equal(row.display_name, w.shownAs);
          assert.ok(row.aliases.length >= 1, `${w.name} keeps its old wording as a search word`);
        }
        if (w.sensitivity) assert.equal(row.sensitivity, w.sensitivity, w.name);
      }

      const count = async (show: boolean) =>
        Number((await run(`SELECT COUNT(*) AS n FROM concepts c WHERE ${visibleClause(show)}`, [])).rows[0].n);
      const reveal = CONCEPT_WORDING.filter((w) => w.sensitivity === "reveal").length;
      const hidden = CONCEPT_WORDING.filter((w) => w.sensitivity === "hidden").length;
      assert.equal(await count(true), names.length - hidden, "a person who chose sensitive meanings sees all but the insults");
      assert.equal(await count(false), names.length - hidden - reveal, "everyone else sees neither");
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
    delete process.env.DS_REFERENCE_BUNDLE;
  }
});
