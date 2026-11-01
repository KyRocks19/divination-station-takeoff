/**
 * Parse "St. Cepesa Horat - R Major Arcana Meanings.csv" and seed reversed
 * card_concept edges for Major Arcana cards into the database.
 * Idempotent — safe to re-run.
 * Usage: npx tsx scripts/seed-reversed-major-arcana.ts [--dry-run]
 *   --dry-run  run everything inside a transaction and roll it back, so nothing is saved
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { referenceDir } from "./reference-dir";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const pool = new Pool({ connectionString: connectionStringFor(process.env.DATABASE_URL) });
const DRY_RUN = process.argv.includes("--dry-run");
// Reference data (CSVs, Obsidian notes) lives outside the repo; override with SEED_DATA_DIR.
const DATA_DIR = referenceDir();

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
    const csv = readFileSync(
      join(DATA_DIR, "St. Cepesa Horat - R Major Arcana Meanings.csv"),
      "utf8"
    );

    const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

    // Row 0: card indices (0–21) — used as column reference
    // Row 1: card names — skip
    // Rows 2+: reversed meanings, one per cell (empty = no more meanings for that card)
    const meaningRows = lines.slice(2);

    // cardIndex → array of meaning strings
    const cardMeanings = new Map<number, string[]>();
    for (let col = 0; col <= 21; col++) cardMeanings.set(col, []);

    for (const line of meaningRows) {
      const cells = line.split(",");
      for (let col = 0; col < cells.length && col <= 21; col++) {
        const meaning = cells[col].trim();
        if (meaning) cardMeanings.get(col)!.push(meaning);
      }
    }

    // Flatten into concept→cardIds map
    const conceptMap = new Map<string, { displayName: string; cardIds: Set<string> }>();

    for (const [cardIndex, meanings] of cardMeanings) {
      const cardId = `major-${cardIndex}`;
      for (const meaning of meanings) {
        const key = meaning.toLowerCase();
        if (!conceptMap.has(key)) {
          conceptMap.set(key, { displayName: toDisplayName(meaning), cardIds: new Set() });
        }
        conceptMap.get(key)!.cardIds.add(cardId);
      }
    }

    const totalPairs = [...conceptMap.values()].reduce((s, v) => s + v.cardIds.size, 0);
    console.log(`Parsed ${conceptMap.size} unique reversed concepts across ${totalPairs} card-concept pairs`);

    // Upsert concepts
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
    console.log(DRY_RUN ? "Dry run complete. Nothing was saved." : "Reversed Major Arcana seed complete.");
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
