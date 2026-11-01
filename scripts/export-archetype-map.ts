/**
 * Writes the database's sorting of tarot concepts (the review page's work) to data/concept-archetypes-export.txt,
 * in the same format as the hand-written files, so it can be committed and read in a diff. Read-only on the database.
 * Usage: npx tsx scripts/export-archetype-map.ts
 */
import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

async function main() {
  const pool = new Pool({ connectionString: connectionStringFor(process.env.DATABASE_URL) });
  const { rows } = await pool.query<{ slug: string; name: string; aspect: string; is_primary: boolean }>(
    `SELECT a.slug, c.name, ca.aspect, ca.is_primary
       FROM concept_archetypes ca JOIN archetypes a ON a.id = ca.archetype_id JOIN concepts c ON c.id = ca.concept_id
      ORDER BY a.sort_order, c.name`
  );
  await pool.end();
  const by = new Map<string, string[]>();
  for (const r of rows) {
    const mark = r.aspect === "shadow" ? "-" : r.aspect === "neutral" ? "~" : "";
    (by.get(r.slug) ?? by.set(r.slug, []).get(r.slug)!).push(`${r.name.replace(/;/g, ",")}${mark}`);
  }
  // Primary links first would matter only when the files are re-read together; the export is one line per archetype,
  // so a concept's first line is its first archetype in archetype order. The database is the real record.
  const out = [
    "# Exported from the database. The review page (/archetypes/review) is where the sorting is edited now.",
    "# Format: slug | name; name; ...   A trailing - marks the hard side, ~ either. Archetypes are in app order.",
    "# Note: in this file a concept appears under every archetype it has. The database also knows which is first.",
    "",
    ...[...by.entries()].map(([slug, names]) => `${slug} | ${names.join("; ")}`),
    "",
  ].join("\n");
  writeFileSync(join(process.cwd(), "data", "concept-archetypes-export.txt"), out);
  console.log(`Wrote ${rows.length} links in ${by.size} archetypes.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
