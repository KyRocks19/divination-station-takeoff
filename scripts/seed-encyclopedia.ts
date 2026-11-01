/**
 * Parse EncyclopediaArcana Obsidian files and populate the concepts + card_concepts tables.
 * Idempotent — safe to re-run.
 * Usage: npx tsx scripts/seed-encyclopedia.ts [--dry-run]
 *   --dry-run  run everything inside a transaction and roll it back, so nothing is saved
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { existsSync, readdirSync, readFileSync } from "fs";
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

// Maps EncyclopediaArcana filename prefix number + suit folder to a card_id
function filenameToCardId(folder: string, filename: string): string | null {
  const base = filename.replace(/\.md$/, "");
  const suit = folder.toLowerCase();

  if (suit === "major arcana") {
    const match = base.match(/^(\d+)\s/);
    if (!match) return null;
    return `major-${match[1]}`;
  }

  // Minor arcana: "1 (Ace) of Cups", "2 (Two) of Cups", "11 (Page) of Cups", etc.
  const match = base.match(/^(\d+)\s+\(([^)]+)\)/);
  if (!match) return null;
  const [, num, word] = match;
  const n = parseInt(num, 10);

  let value: string;
  if (n === 1) value = "ace";
  else if (n === 11) value = "page";
  else if (n === 12) value = "knight";
  else if (n === 13) value = "queen";
  else if (n === 14) value = "king";
  else value = String(n);

  return `${suit}-${value}`;
}

function parseWikiLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1].trim();
    if (raw) links.push(raw);
  }
  return links;
}

// Choose the "best" display name: prefer sentence-case (first letter uppercase, rest lower)
// but keep whatever has the most natural casing from the data
function bestDisplayName(existing: string, candidate: string): string {
  // Prefer the one where the first char is uppercase and rest is not all-caps
  const isNice = (s: string) => s[0] === s[0].toUpperCase() && s !== s.toUpperCase();
  if (isNice(candidate) && !isNice(existing)) return candidate;
  return existing;
}

async function run() {
  const client = await pool.connect();
  try {
    if (DRY_RUN) {
      await client.query("BEGIN");
      console.log("DRY RUN: all changes will be rolled back");
    }
    // Run migration first
    const migrationSql = readFileSync(join(process.cwd(), "migrations/007_encyclopedia.sql"), "utf8");
    await client.query(migrationSql);
    console.log("✓ Migration applied");

    const root = join(DATA_DIR, "EncyclopediaArcana");
    const folders = ["Major Arcana", "Cups", "Wands", "Swords", "Pentacles"];

    // concept name (lowercase) → { displayName, cardIds }
    const conceptMap = new Map<string, { displayName: string; cardIds: Set<string> }>();

    for (const folder of folders) {
      const dir = join(root, folder);
      let files: string[];
      try {
        files = readdirSync(dir).filter((f) => f.endsWith(".md"));
      } catch {
        console.warn(`  Skipping missing folder: ${folder}`);
        continue;
      }

      for (const file of files) {
        const cardId = filenameToCardId(folder, file);
        if (!cardId) {
          console.warn(`  Could not map filename: ${folder}/${file}`);
          continue;
        }

        const content = readFileSync(join(dir, file), "utf8");
        const links = parseWikiLinks(content);

        for (const link of links) {
          const key = link.toLowerCase();
          if (!conceptMap.has(key)) {
            conceptMap.set(key, { displayName: link, cardIds: new Set() });
          }
          const entry = conceptMap.get(key)!;
          entry.displayName = bestDisplayName(entry.displayName, link);
          entry.cardIds.add(cardId);
        }
      }
    }

    console.log(`  Parsed ${conceptMap.size} unique concepts across 78 cards`);

    // Upsert concepts
    let conceptsInserted = 0;
    let conceptsUpdated = 0;
    const conceptIdMap = new Map<string, number>(); // key → db id

    for (const [key, { displayName }] of conceptMap) {
      const existing = await client.query(
        "SELECT id FROM concepts WHERE name = $1",
        [key]
      );
      if (existing.rows.length > 0) {
        conceptIdMap.set(key, existing.rows[0].id);
        conceptsUpdated++;
      } else {
        const res = await client.query(
          "INSERT INTO concepts (name, display_name) VALUES ($1, $2) RETURNING id",
          [key, displayName]
        );
        conceptIdMap.set(key, res.rows[0].id);
        conceptsInserted++;
      }
    }

    console.log(`✓ Concepts: ${conceptsInserted} inserted, ${conceptsUpdated} already existed`);

    // Upsert card_concepts
    let edgesInserted = 0;
    let edgesExisting = 0;
    for (const [key, { cardIds }] of conceptMap) {
      const conceptId = conceptIdMap.get(key)!;
      for (const cardId of cardIds) {
        const res = await client.query(
          "INSERT INTO card_concepts (card_id, concept_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [cardId, conceptId]
        );
        if (res.rowCount) edgesInserted++;
        else edgesExisting++;
      }
    }

    console.log(`✓ Card-concept edges: ${edgesInserted} new, ${edgesExisting} already existed`);
    console.log(DRY_RUN ? "Dry run complete. Nothing was saved." : "Encyclopedia seed complete.");
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
