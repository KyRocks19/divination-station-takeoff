/**
 * Makes the reference bundle the full local edition loads into a fresh folder (lib/local-seed.ts): every shared concept, its card links and its
 * archetype links, read from a database, written to one JSON file. Read-only on the database. The file holds the encyclopedia text (docs/provenance.md,
 * item 4), so it stays out of the repository (.gitignore) and goes into a download only after Felix G's yes and the owner's provenance answers (Y15).
 *
 * It never reads .env files. Point it at the dev branch yourself:
 *   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
 *   npx tsx scripts/export-reference-bundle.ts [--out data/reference-bundle.json] [--allow-live]
 * It refuses any database but your dev one (scripts/dev-database.ts) unless you pass --allow-live.
 */

import { hostOf, isDevDatabase, NOT_DEV } from "./dev-database";
import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { BUNDLE_FORMAT, type ReferenceBundle } from "../lib/local-seed-core";

const outAt = process.argv.indexOf("--out");
const OUT = outAt >= 0 ? process.argv[outAt + 1] : join(process.cwd(), "data", "reference-bundle.json");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL first (see the top of this file). This script never reads .env files.");
  const host = hostOf(url);
  console.log("Database host:", host);
  if (!isDevDatabase(host) && !process.argv.includes("--allow-live")) {
    throw new Error(`${NOT_DEV} Pass --allow-live to read another database on purpose.`);
  }
  const pool = new Pool({ connectionString: connectionStringFor(url) });
  try {
    const concepts = (await pool.query("SELECT name, display_name, description FROM concepts ORDER BY id")).rows as { name: string; display_name: string; description: string | null }[];
    const cardConcepts = (await pool.query("SELECT cc.card_id, c.name AS concept, cc.reversed FROM card_concepts cc JOIN concepts c ON c.id = cc.concept_id ORDER BY c.id, cc.card_id, cc.reversed")).rows as { card_id: string; concept: string; reversed: boolean }[];
    const links = (await pool.query("SELECT c.name AS concept, a.slug, ca.aspect, ca.is_primary AS \"primary\" FROM concept_archetypes ca JOIN concepts c ON c.id = ca.concept_id JOIN archetypes a ON a.id = ca.archetype_id ORDER BY c.id, ca.is_primary DESC, a.slug")).rows as ReferenceBundle["concept_archetypes"];
    const bundle: ReferenceBundle = { format: BUNDLE_FORMAT, version: 1, concepts, card_concepts: cardConcepts, concept_archetypes: links };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(bundle));
    console.log(`Wrote ${OUT}: ${concepts.length} concepts, ${cardConcepts.length} card links, ${links.length} archetype links.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("export FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
