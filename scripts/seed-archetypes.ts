/**
 * Writes the root archetypes (lib/archetypes-data.ts) and the sorting of tarot concepts under them
 * (data/concept-archetypes-*.txt) into the database, in one transaction. Nothing in `concepts`, `card_concepts`,
 * or `concept_notes` is touched.
 *
 * Since the review page (/archetypes/review) exists, the DATABASE holds the sorting people have reviewed, so by
 * default this script only (1) writes the archetypes themselves and (2) sorts concepts that have no archetype yet,
 * from the text files. It never overwrites a change made in the review page. To throw the database's sorting away
 * and start again from the text files, pass --replace-links. To save the database's sorting back into files, run
 * scripts/export-archetype-map.ts.
 * Usage: npx tsx scripts/seed-archetypes.ts [--dry-run] [--replace-links]
 *   --dry-run        run everything inside a transaction and roll it back, so nothing is saved
 *   --replace-links  replace every concept's links with what the text files say
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { ARCHETYPES } from "../lib/archetypes-data";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

const DRY_RUN = process.argv.includes("--dry-run");
const REPLACE = process.argv.includes("--replace-links");
const pool = new Pool({ connectionString: connectionStringFor(process.env.DATABASE_URL) });

/** The same cleaning the checker uses: case, zero-width spaces, stray full stops and quotes, spacing. */
const norm = (s: string) => s.toLowerCase().replace(/[​]/g, "").replace(/[.“”"]/g, "").replace(/\s+/g, " ").trim();

type Aspect = "light" | "shadow" | "neutral";

/** concept key -> { aspect from its first (primary) line, archetype slugs in order of first appearance } */
function readMapping(): Map<string, { aspect: Aspect; slugs: string[] }> {
  const dir = join(process.cwd(), "data");
  const files = readdirSync(dir).filter((f) => /^concept-archetypes-\d.*\.txt$/.test(f)).sort();
  const known = new Set(ARCHETYPES.map((a) => a.slug));
  const out = new Map<string, { aspect: Aspect; slugs: string[] }>();
  for (const f of files) {
    for (const [i, line] of readFileSync(join(dir, f), "utf8").split("\n").entries()) {
      if (!line.trim() || line.startsWith("#")) continue;
      const bar = line.indexOf("|");
      const slug = line.slice(0, bar).trim();
      if (!known.has(slug)) throw new Error(`${f}:${i + 1}: unknown archetype "${slug}"`);
      for (let name of line.slice(bar + 1).split(";")) {
        name = name.trim();
        if (!name) continue;
        const mark = /[-~]$/.exec(name)?.[0];
        const key = norm(mark ? name.slice(0, -1) : name);
        const aspect: Aspect = mark === "-" ? "shadow" : mark === "~" ? "neutral" : "light";
        const have = out.get(key);
        if (!have) out.set(key, { aspect, slugs: [slug] });
        else if (!have.slugs.includes(slug)) have.slugs.push(slug); // a concept has one aspect: its primary line's
      }
    }
  }
  return out;
}

async function main() {
  const mapping = readMapping();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const idOf = new Map<string, number>();
    for (const [i, a] of ARCHETYPES.entries()) {
      const { rows } = await client.query(
        `INSERT INTO archetypes (slug, name, realm, summary, light, shadow, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET name=$2, realm=$3, summary=$4, light=$5, shadow=$6, sort_order=$7
         RETURNING id`,
        [a.slug, a.name, a.realm, a.summary, a.light, a.shadow, i]
      );
      idOf.set(a.slug, rows[0].id);
    }
    // An archetype removed from the code leaves its row and its links: delete only after the links are rewritten.
    if (REPLACE) await client.query("DELETE FROM concept_archetypes");
    // Without --replace-links, only concepts that have no archetype yet are sorted.
    const { rows: concepts } = await client.query<{ id: number; name: string }>(
      REPLACE
        ? "SELECT id, name FROM concepts"
        : "SELECT id, name FROM concepts c WHERE NOT EXISTS (SELECT 1 FROM concept_archetypes x WHERE x.concept_id = c.id)"
    );
    let linked = 0, unsorted = 0;
    const per: Record<string, number> = {};
    for (const c of concepts) {
      const m = mapping.get(norm(c.name));
      if (!m) { unsorted++; console.log("not sorted:", c.name); continue; }
      for (const [i, slug] of m.slugs.entries()) {
        await client.query(
          "INSERT INTO concept_archetypes (concept_id, archetype_id, aspect, is_primary) VALUES ($1,$2,$3,$4)",
          [c.id, idOf.get(slug), m.aspect, i === 0]
        );
        linked++;
        if (i === 0) per[slug] = (per[slug] ?? 0) + 1;
      }
    }
    await client.query("DELETE FROM archetypes WHERE slug <> ALL($1::text[])", [ARCHETYPES.map((a) => a.slug)]);
    console.log(`${ARCHETYPES.length} archetypes; ${concepts.length} concepts; ${linked} links; ${unsorted} not sorted`);
    console.log(Object.entries(per).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(", "));
    await client.query(DRY_RUN ? "ROLLBACK" : "COMMIT");
    console.log(DRY_RUN ? "Dry run: rolled back." : "Saved.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
