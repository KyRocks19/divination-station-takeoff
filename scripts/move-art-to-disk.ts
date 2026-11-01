/**
 * Moves pictures that are stored inside the database onto the disk, so the database only keeps a small record of each.
 *
 *   DATABASE_URL=... ART_DIR=... npx tsx scripts/move-art-to-disk.ts            (shows what would move; changes nothing)
 *   DATABASE_URL=... ART_DIR=... npx tsx scripts/move-art-to-disk.ts --yes      (moves them)
 *   ... --yes --vacuum                                                          (then shrinks the tables so the database really gets smaller)
 *   ... --user 12                                                               (only that person's pictures)
 *
 * Both variables must be set in the environment on purpose: this script never reads .env files, so it cannot touch
 * the live database by accident. It prints the database's host name first (never the password).
 *
 * For each picture: write the file, read it back and compare, and only then empty the row's bytes in one statement
 * (WHERE file_key IS NULL, so a row is never moved twice). A picture that fails is left exactly as it was.
 * Run it once per database (the Neon dev branch and the live database are separate). The files go into the same
 * ART_DIR; their names are random, so the two never clash.
 */

import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { artDir, extFor, readArt, writeArt } from "../lib/art-store";

const yes = process.argv.includes("--yes");
const vacuum = process.argv.includes("--vacuum");
const userFlag = process.argv.indexOf("--user");
const onlyUser = userFlag >= 0 ? Number(process.argv[userFlag + 1]) : null;

async function main() {
  const url = process.env.DATABASE_URL;
  const dir = artDir();
  if (!url) throw new Error("DATABASE_URL is not set in the environment.");
  if (!dir) throw new Error("ART_DIR is not set in the environment.");
  console.log(`Database host: ${new URL(url).hostname.split(".")[0]}`);
  console.log(`Art folder:    ${dir}`);
  console.log(yes ? "Mode: MOVE" : "Mode: dry run (add --yes to move)");
  if (userFlag >= 0 && !(onlyUser && Number.isInteger(onlyUser) && onlyUser > 0)) throw new Error("--user needs a user id.");
  if (onlyUser) console.log(`Only user ${onlyUser}`);

  const pool = new Pool({ connectionString: connectionStringFor(url), ssl: { rejectUnauthorized: true } });
  try {
    const cards = (
      await pool.query(
        `SELECT card_id AS id, user_id, kind, mime, data, strokes FROM oracle_card_art
         WHERE file_key IS NULL AND ($1::int IS NULL OR user_id = $1::int) ORDER BY card_id`,
        [onlyUser]
      )
    ).rows;
    const gallery = (
      await pool.query(
        `SELECT id, user_id, mime, data FROM oracle_gallery
         WHERE file_key IS NULL AND ($1::int IS NULL OR user_id = $1::int) ORDER BY id`,
        [onlyUser]
      )
    ).rows;

    let bytesFreed = 0;
    let moved = 0;
    let failed = 0;

    async function move(table: "oracle_card_art" | "oracle_gallery", idColumn: string, row: any) {
      const isDrawing = table === "oracle_card_art" && row.kind === "drawing";
      const bytes: Buffer = isDrawing ? Buffer.from(row.strokes, "utf8") : row.data;
      const label = `${table} ${row.id} (user ${row.user_id}, ${isDrawing ? "drawing" : row.mime}, ${bytes.length} bytes)`;
      if (!yes) {
        console.log(`would move ${label}`);
        bytesFreed += bytes.length;
        return;
      }
      let key: string | null = null;
      try {
        key = await writeArt(row.user_id, bytes, isDrawing ? "json" : extFor(row.mime));
        const back = await readArt(key, row.user_id);
        if (!back || !back.equals(bytes)) throw new Error("the file read back differently");
        const res = await pool.query(
          isDrawing
            ? `UPDATE ${table} SET file_key = $1, strokes = NULL WHERE ${idColumn} = $2 AND file_key IS NULL`
            : `UPDATE ${table} SET file_key = $1, data = NULL WHERE ${idColumn} = $2 AND file_key IS NULL`,
          [key, row.id]
        );
        if (res.rowCount !== 1) throw new Error("the row changed while moving");
        moved++;
        bytesFreed += bytes.length;
        console.log(`moved ${label}`);
      } catch (err) {
        failed++;
        console.log(`FAILED ${label}: ${err instanceof Error ? err.message : err}`);
        if (key) await (await import("../lib/art-store")).deleteArt([key], row.user_id);
      }
    }

    for (const row of cards) await move("oracle_card_art", "card_id", row);
    for (const row of gallery) await move("oracle_gallery", "id", row);

    console.log(
      `${yes ? "Moved" : "Would move"} ${yes ? moved : cards.length + gallery.length} picture(s), ` +
        `${(bytesFreed / 1e6).toFixed(2)} MB${failed ? `; ${failed} failed and were left as they were` : ""}.`
    );
    if (yes && vacuum) {
      console.log("Shrinking the tables (VACUUM FULL; they are locked for a moment)...");
      await pool.query("VACUUM FULL oracle_card_art");
      await pool.query("VACUUM FULL oracle_gallery");
      console.log("Done.");
    } else if (yes && moved > 0) {
      console.log("The database still holds the old space until the tables are rewritten. Run again with --yes --vacuum to shrink them.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
