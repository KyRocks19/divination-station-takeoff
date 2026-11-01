/**
 * Parse "St. Cepesa Horat - R Meanings Duplicates.csv" and seed reversed
 * card_concept edges into the database.
 * Idempotent — safe to re-run.
 * Usage: npx tsx scripts/seed-reversed-concepts.ts [--dry-run]
 *   --dry-run  run everything inside a transaction and roll it back, so nothing is saved
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { referenceDir } from "./reference-dir";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

const pool = new Pool({ connectionString: connectionStringFor(process.env.DATABASE_URL) });
const DRY_RUN = process.argv.includes("--dry-run");
// Reference data (CSVs, Obsidian notes) lives outside the repo; override with SEED_DATA_DIR.
const DATA_DIR = referenceDir();

// Suit letter → suit slug
const SUIT: Record<string, string> = {
  W: "wands",
  P: "pentacles",
  S: "swords",
  C: "cups",
};

// Rank string → rank slug
const RANK: Record<string, string> = {
  "1":  "ace",
  "2":  "2",
  "3":  "3",
  "4":  "4",
  "5":  "5",
  "6":  "6",
  "7":  "7",
  "8":  "8",
  "9":  "9",
  "10": "10",
  P:    "page",
  N:    "knight",
  Q:    "queen",
  K:    "king",
};

// "2W" → "wands-2",  "PW" → "wands-page",  "10P" → "pentacles-10", etc.
// The suit is always the last character; everything before it is the rank.
function abbrevToCardId(abbrev: string): string | null {
  const trimmed = abbrev.trim();
  const suitChar = trimmed.slice(-1);
  const rankStr  = trimmed.slice(0, -1);
  const suit = SUIT[suitChar];
  const rank = RANK[rankStr];
  if (!suit || !rank) return null;
  return `${suit}-${rank}`;
}

// Normalise display_name: first letter uppercase, rest as-is
function toDisplayName(raw: string): string {
  if (!raw) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function run() {
  const client = await pool.connect();
  try {
    if (DRY_RUN) {
      await client.query("BEGIN");
      console.log("DRY RUN: all changes will be rolled back");
    }
    // Apply migration first (idempotent)
    const migrationSql = readFileSync(
      join(process.cwd(), "migrations/011_reversed_concepts.sql"),
      "utf8"
    );
    await client.query(migrationSql);
    console.log("✓ Migration 011 applied");

    const csv = readFileSync(
      join(DATA_DIR, "St. Cepesa Horat - R Meanings Duplicates.csv"),
      "utf8"
    );

    // Skip the blank header row; iterate remaining lines
    const lines = csv.split(/\r?\n/).slice(1);

    // concept key (lowercase) → { displayName, cardIds }
    const conceptMap = new Map<string, { displayName: string; cardIds: Set<string> }>();
    let parseErrors = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // CSV rows look like:  42,"concept text",3W
      // The concept may contain commas and be quoted.
      // Split on the first comma (row num), then parse remainder.
      const firstComma = trimmed.indexOf(",");
      if (firstComma === -1) continue;
      const rest = trimmed.slice(firstComma + 1); // "concept text",3W  OR  concept text,3W

      let conceptRaw: string;
      let abbrev: string;

      if (rest.startsWith('"')) {
        // Quoted concept — find closing quote
        const closeQuote = rest.indexOf('"', 1);
        if (closeQuote === -1) { parseErrors++; continue; }
        conceptRaw = rest.slice(1, closeQuote).replace(/""/g, '"');
        const afterQuote = rest.slice(closeQuote + 1);
        // afterQuote should be  ,3W
        const commaPos = afterQuote.indexOf(",");
        if (commaPos === -1) { parseErrors++; continue; }
        abbrev = afterQuote.slice(commaPos + 1).trim();
      } else {
        // Unquoted — last comma separates concept from card abbrev
        const lastComma = rest.lastIndexOf(",");
        if (lastComma === -1) { parseErrors++; continue; }
        conceptRaw = rest.slice(0, lastComma);
        abbrev = rest.slice(lastComma + 1).trim();
      }

      const conceptText = conceptRaw.trim();
      if (!conceptText) continue;

      const cardId = abbrevToCardId(abbrev);
      if (!cardId) {
        console.warn(`  Unknown card abbreviation: "${abbrev}" (concept: "${conceptText}")`);
        parseErrors++;
        continue;
      }

      const key = conceptText.toLowerCase();
      if (!conceptMap.has(key)) {
        conceptMap.set(key, { displayName: toDisplayName(conceptText), cardIds: new Set() });
      }
      conceptMap.get(key)!.cardIds.add(cardId);
    }

    if (parseErrors > 0) {
      console.warn(`  ${parseErrors} lines could not be parsed`);
    }
    console.log(`  Parsed ${conceptMap.size} unique reversed concepts across ${
      [...conceptMap.values()].reduce((s, v) => s + v.cardIds.size, 0)
    } card-concept pairs`);

    // Upsert concepts (reversed concepts are real concept entities — they just
    // happen to only link to cards via reversed=true edges)
    let newConcepts = 0;
    let existingConcepts = 0;
    const conceptIdMap = new Map<string, number>();

    for (const [key, { displayName }] of conceptMap) {
      const existing = await client.query(
        "SELECT id FROM concepts WHERE name = $1",
        [key]
      );
      if (existing.rows.length > 0) {
        conceptIdMap.set(key, existing.rows[0].id);
        existingConcepts++;
      } else {
        const res = await client.query(
          "INSERT INTO concepts (name, display_name) VALUES ($1, $2) RETURNING id",
          [key, displayName]
        );
        conceptIdMap.set(key, res.rows[0].id);
        newConcepts++;
      }
    }

    console.log(`✓ Concepts: ${newConcepts} new, ${existingConcepts} already existed`);

    // Upsert reversed card_concepts edges
    let edgesInserted = 0;
    let edgesExisting = 0;
    for (const [key, { cardIds }] of conceptMap) {
      const conceptId = conceptIdMap.get(key)!;
      for (const cardId of cardIds) {
        const res = await client.query(
          `INSERT INTO card_concepts (card_id, concept_id, reversed)
           VALUES ($1, $2, true)
           ON CONFLICT DO NOTHING`,
          [cardId, conceptId]
        );
        if (res.rowCount) edgesInserted++;
        else edgesExisting++;
      }
    }

    console.log(`✓ Reversed card-concept edges: ${edgesInserted} new, ${edgesExisting} already existed`);
    console.log(DRY_RUN ? "Dry run complete. Nothing was saved." : "Reversed concepts seed complete.");
  } finally {
    if (DRY_RUN) await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
