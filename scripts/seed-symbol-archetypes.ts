/**
 * Writes the hand-written links between pieces of a ritual set and the shared archetypes
 * (data/symbol-archetypes-runes.txt, -ogham.txt, -dice.txt, -pendulum.txt and -scrying.txt) into symbol_archetypes and
 * symbol_notes (migration 059),
 * in one transaction. Nothing else is touched.
 *
 * Like the concept sorting, the DATABASE is the record once it is seeded (an admin page will edit it), so by default
 * this script only writes pieces that have no rows yet and never overwrites a later change. To throw a piece's rows away
 * and start again from the file, pass --replace-links.
 *
 * It never reads .env files, so it cannot reach the live database by accident. Point it at the dev branch yourself:
 *   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
 *   npx tsx scripts/seed-symbol-archetypes.ts --dry-run
 * It refuses any database but your dev one (scripts/dev-database.ts) unless you pass --allow-live.
 *
 * Usage: npx tsx scripts/seed-symbol-archetypes.ts [--dry-run] [--replace-links] [--only runes|ogham|dice|pendulum|scrying] [--allow-live]
 *   --dry-run        do everything inside a transaction and roll it back, so nothing is saved
 *   --replace-links  replace the rows of every piece in the files (or of --only) with what the file says
 */

import { hostOf, isDevDatabase, NOT_DEV } from "./dev-database";
import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { ARCHETYPES } from "../lib/archetypes-data";
import { symbolSets } from "../lib/symbol-seed-sets";
import { SOURCES } from "../lib/sources";
import { checkSymbolMap, parseSymbolArchetypeFile } from "../lib/symbol-archetype-map";

const DRY_RUN = process.argv.includes("--dry-run");
const REPLACE = process.argv.includes("--replace-links");
const ALLOW_LIVE = process.argv.includes("--allow-live");
const onlyAt = process.argv.indexOf("--only");
const ONLY = onlyAt >= 0 ? process.argv[onlyAt + 1] : null;


const SETS = symbolSets().filter((s) => !ONLY || s.tool === ONLY);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL first (see the top of this file). This script never reads .env files.");
  const host = hostOf(url);
  console.log("Database host:", host);
  if (!isDevDatabase(host) && !ALLOW_LIVE) {
    throw new Error(`${NOT_DEV} Pass --allow-live to write to another database on purpose.`);
  }
  if (ONLY && SETS.length === 0) throw new Error(`--only must be runes, ogham, dice, pendulum or scrying, not "${ONLY}"`);
  if (DRY_RUN) console.log("DRY RUN: nothing will be saved.");

  // Read and check every file before touching the database.
  const known = new Set(ARCHETYPES.map((a) => a.slug));
  const sourceIds = new Set(SOURCES.map((s) => s.id));
  const parsed = SETS.map((s) => {
    const map = parseSymbolArchetypeFile(readFileSync(join(process.cwd(), s.file), "utf8"));
    const problems = checkSymbolMap(map, s.ids, known, sourceIds);
    if (problems.length) throw new Error(`${s.file} has problems:\n  ${problems.join("\n  ")}`);
    return { ...s, map };
  });

  const pool = new Pool({ connectionString: connectionStringFor(url) });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tables = await client.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name IN ('symbol_archetypes', 'symbol_notes') AND table_schema = current_schema()"
    );
    if (Number(tables.rows[0].n) !== 2) throw new Error("symbol_archetypes and symbol_notes are missing. Run migration 059 first.");

    const idOf = new Map<string, number>();
    for (const r of (await client.query<{ id: number; slug: string }>("SELECT id, slug FROM archetypes")).rows) idOf.set(r.slug, r.id);
    const missing = [...known].filter((s) => !idOf.has(s));
    if (missing.length) throw new Error(`The archetypes table lacks: ${missing.join(", ")}. Run scripts/seed-archetypes.ts first.`);

    let written = 0, skipped = 0, links = 0, notes = 0;
    for (const set of parsed) {
      let setWritten = 0, setSkipped = 0;
      for (const e of set.map.entries) {
        const have = await client.query<{ n: string }>(
          `SELECT (SELECT COUNT(*) FROM symbol_archetypes WHERE symbol_id = $1) + (SELECT COUNT(*) FROM symbol_notes WHERE symbol_id = $1) AS n`,
          [e.id]
        );
        if (Number(have.rows[0].n) > 0 && !REPLACE) {
          setSkipped++;
          continue;
        }
        if (REPLACE) {
          await client.query("DELETE FROM symbol_archetypes WHERE symbol_id = $1", [e.id]);
          await client.query("DELETE FROM symbol_notes WHERE symbol_id = $1", [e.id]);
        }
        for (const [i, l] of e.links.entries()) {
          await client.query(
            `INSERT INTO symbol_archetypes (symbol_id, archetype_id, aspect, is_primary, basis, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
            [e.id, idOf.get(l.slug), l.aspect, l.primary, l.basis, i]
          );
          links++;
        }
        if (e.note) {
          await client.query("INSERT INTO symbol_notes (symbol_id, note) VALUES ($1, $2)", [e.id, e.note]);
          notes++;
        }
        setWritten++;
      }
      written += setWritten;
      skipped += setSkipped;
      console.log(`${set.tool}: ${setWritten} pieces written, ${setSkipped} left alone (already in the database)`);
    }

    // Check what the database now holds for these pieces.
    const problems: string[] = [];
    for (const set of parsed) {
      const rows = (
        await client.query<{ symbol_id: string; n: string; primaries: string }>(
          `SELECT symbol_id, COUNT(*) AS n, COUNT(*) FILTER (WHERE is_primary) AS primaries
             FROM symbol_archetypes WHERE symbol_id = ANY($1) GROUP BY symbol_id`,
          [set.ids]
        )
      ).rows;
      const noted = new Set(
        (await client.query<{ symbol_id: string }>("SELECT symbol_id FROM symbol_notes WHERE symbol_id = ANY($1)", [set.ids])).rows.map((r) => r.symbol_id)
      );
      const linked = new Set(rows.map((r) => r.symbol_id));
      for (const r of rows) if (Number(r.primaries) !== 1) problems.push(`${r.symbol_id} has ${r.primaries} primary links`);
      for (const id of set.ids) if (!linked.has(id) && !noted.has(id)) problems.push(`${id} has no archetype and no note`);
      const total = (await client.query<{ n: string }>("SELECT COUNT(*) AS n FROM symbol_archetypes WHERE symbol_id = ANY($1)", [set.ids])).rows[0].n;
      console.log(`${set.tool}: in the database now: ${linked.size} pieces with links (${total} links), ${set.ids.length - linked.size} with none on purpose and a note`);
    }
    if (problems.length) throw new Error(`After writing, the database is not as expected:\n  ${problems.join("\n  ")}`);

    console.log(`This run: ${written} pieces written (${links} links, ${notes} notes), ${skipped} left alone.`);
    await client.query(DRY_RUN ? "ROLLBACK" : "COMMIT");
    console.log(DRY_RUN ? "Rolled back (dry run)." : "Committed.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("seed FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
