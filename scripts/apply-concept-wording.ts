// Applies lib/concept-wording-data.ts to the database in DATABASE_URL (open item ED21): reworded concepts get their new display name
// (the old one is kept as an alias for search and import), sensitive ones are marked 'reveal', and plain insults are marked 'hidden'.
// Needs migration 084 first. Safe to run again. Reads the live database from .env.local like every script, so the guard hook refuses a run
// that is not aimed at the dev branch; the owner runs it on live.
//
//   npx tsx scripts/apply-concept-wording.ts          (shows what it would change)
//   npx tsx scripts/apply-concept-wording.ts --write  (changes it)

import { getPool } from "../lib/db";
import { applyConceptWording } from "../lib/concept-wording";

async function main() {
  const write = process.argv.includes("--write");
  const pool = getPool();
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/:?]+).*/, "$1");
  console.log(`${write ? "Writing to" : "Dry run on"} ${host}`);
  try {
    const report = await applyConceptWording((sql, params) => pool.query(sql, params as any[]), write);
    console.log(`Reworded (${report.renamed.length}):\n  ${report.renamed.join("\n  ") || "none"}`);
    console.log(`Marked (${report.marked.length}):\n  ${report.marked.join("\n  ") || "none"}`);
    console.log(`Already as wanted: ${report.already}`);
    if (report.clashes.length) console.log(`NOT reworded, the new wording is already another concept's name:\n  ${report.clashes.join("\n  ")}`);
    if (report.missing.length) console.log(`Not in this database: ${report.missing.map((n) => JSON.stringify(n)).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
