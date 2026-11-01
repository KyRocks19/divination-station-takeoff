/**
 * Imports all data from tarot.db (SQLite) into PostgreSQL (Neon).
 * Clears existing Postgres data first, so run this only once.
 *
 * Usage:
 *   npx tsx scripts/import-sqlite.ts
 */

import Database from "better-sqlite3";
import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import * as path from "path";
import * as fs from "fs";
import { referenceDir } from "./reference-dir";

// Load .env.local without requiring dotenv package
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

// Reference data lives outside the repo; override with SEED_DATA_DIR.
const DATA_DIR = referenceDir();
const sqlitePath = path.resolve(DATA_DIR, "tarot.db");
if (!fs.existsSync(sqlitePath)) {
  console.error("tarot.db not found at", sqlitePath);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set in .env.local");
  process.exit(1);
}

const sqlite = new Database(sqlitePath);
const pool = new Pool({ connectionString: connectionStringFor(process.env.DATABASE_URL) });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Truncating existing Postgres data...");
    await client.query(`
      TRUNCATE TABLE
        forum_comments,
        forum_post_attachments,
        forum_posts,
        spread_color_overrides,
        card_draws,
        synthesis_journals,
        journals,
        readings,
        spreads,
        users,
        settings
      RESTART IDENTITY CASCADE
    `);

    // settings (no serial PK)
    {
      const rows = sqlite.prepare("SELECT * FROM settings").all() as any[];
      for (const r of rows) {
        await client.query(
          "INSERT INTO settings (key, value) VALUES ($1, $2)",
          [r.key, r.value]
        );
      }
      console.log(`settings: ${rows.length} rows`);
    }

    // users
    {
      const rows = sqlite.prepare("SELECT * FROM users").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO users (id, username, display_name, password_hash, is_admin, guide_name, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [r.id, r.username, r.display_name, r.password_hash, r.is_admin, r.guide_name, r.created_at]
        );
      }
      await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
      console.log(`users: ${rows.length} rows`);
    }

    // spreads
    {
      const rows = sqlite.prepare("SELECT * FROM spreads").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO spreads (id, name, description, positions, is_preset, user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [r.id, r.name, r.description, r.positions, r.is_preset, r.user_id, r.created_at]
        );
      }
      await client.query(`SELECT setval('spreads_id_seq', (SELECT MAX(id) FROM spreads))`);
      console.log(`spreads: ${rows.length} rows`);
    }

    // readings
    {
      const rows = sqlite.prepare("SELECT * FROM readings").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO readings (id, user_id, spread_id, spread_name, title, question, cards, clarifiers, notes, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [r.id, r.user_id, r.spread_id, r.spread_name, r.title, r.question, r.cards, r.clarifiers, r.notes, r.created_at]
        );
      }
      await client.query(`SELECT setval('readings_id_seq', (SELECT MAX(id) FROM readings))`);
      console.log(`readings: ${rows.length} rows`);
    }

    // journals
    {
      const rows = sqlite.prepare("SELECT * FROM journals").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO journals (id, reading_id, author, content, card_index, clarifier_index, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [r.id, r.reading_id, r.author, r.content, r.card_index, r.clarifier_index, r.created_at]
        );
      }
      await client.query(`SELECT setval('journals_id_seq', (SELECT MAX(id) FROM journals))`);
      console.log(`journals: ${rows.length} rows`);
    }

    // synthesis_journals
    {
      const rows = sqlite.prepare("SELECT * FROM synthesis_journals").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO synthesis_journals (id, user_id, prompt, content, context_ids, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [r.id, r.user_id, r.prompt, r.content, r.context_ids, r.created_at]
        );
      }
      await client.query(`SELECT setval('synthesis_journals_id_seq', (SELECT MAX(id) FROM synthesis_journals))`);
      console.log(`synthesis_journals: ${rows.length} rows`);
    }

    // card_draws
    {
      const rows = sqlite.prepare("SELECT * FROM card_draws").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO card_draws (id, user_id, reading_id, card_id, card_name, position_name, spread_name, reversed, is_clarifier, clarifies_card_id, clarifies_position, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [r.id, r.user_id, r.reading_id, r.card_id, r.card_name, r.position_name, r.spread_name, r.reversed, r.is_clarifier, r.clarifies_card_id, r.clarifies_position, r.created_at]
        );
      }
      await client.query(`SELECT setval('card_draws_id_seq', (SELECT MAX(id) FROM card_draws))`);
      console.log(`card_draws: ${rows.length} rows`);
    }

    // spread_color_overrides (composite PK, no serial)
    {
      const rows = sqlite.prepare("SELECT * FROM spread_color_overrides").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO spread_color_overrides (user_id, spread_id, colors) VALUES ($1,$2,$3)`,
          [r.user_id, r.spread_id, r.colors]
        );
      }
      console.log(`spread_color_overrides: ${rows.length} rows`);
    }

    // forum_posts
    {
      const rows = sqlite.prepare("SELECT * FROM forum_posts").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO forum_posts (id, user_id, title, body, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [r.id, r.user_id, r.title, r.body, r.created_at, r.updated_at]
        );
      }
      await client.query(`SELECT setval('forum_posts_id_seq', (SELECT MAX(id) FROM forum_posts))`);
      console.log(`forum_posts: ${rows.length} rows`);
    }

    // forum_post_attachments
    {
      const rows = sqlite.prepare("SELECT * FROM forum_post_attachments").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO forum_post_attachments (id, post_id, type, ref_id, snapshot)
           VALUES ($1,$2,$3,$4,$5)`,
          [r.id, r.post_id, r.type, r.ref_id, r.snapshot]
        );
      }
      await client.query(`SELECT setval('forum_post_attachments_id_seq', (SELECT MAX(id) FROM forum_post_attachments))`);
      console.log(`forum_post_attachments: ${rows.length} rows`);
    }

    // forum_comments
    {
      const rows = sqlite.prepare("SELECT * FROM forum_comments").all() as any[];
      for (const r of rows) {
        await client.query(
          `INSERT INTO forum_comments (id, post_id, user_id, content, created_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [r.id, r.post_id, r.user_id, r.content, r.created_at]
        );
      }
      if (rows.length > 0) {
        await client.query(`SELECT setval('forum_comments_id_seq', (SELECT MAX(id) FROM forum_comments))`);
      }
      console.log(`forum_comments: ${rows.length} rows`);
    }

    await client.query("COMMIT");
    console.log("\nAll data imported successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nImport failed, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

run().catch(() => process.exit(1));
