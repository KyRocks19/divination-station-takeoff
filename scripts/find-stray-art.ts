/**
 * Finds picture files that no database row points to, and rows whose file is missing (open item P5). Read-only unless --yes.
 *
 *   DATABASE_URL=... DATABASE_URL_2=... ART_DIR=... npx tsx scripts/find-stray-art.ts           (a report; changes nothing)
 *   ... npx tsx scripts/find-stray-art.ts --yes                                                  (moves stray files into ART_DIR/_orphans)
 *
 * The dev branch and the live database share ONE art folder, so a file the dev branch has no row for may belong to live. Give BOTH
 * addresses (DATABASE_URL and DATABASE_URL_2); with only one the report says what it cannot know and --yes is refused. Nothing is
 * ever deleted: strays are moved to _orphans (keeping their folder), only if they are at least a day old (a picture saved a moment
 * ago may not have its row yet), and a moved file can be put back by moving it out again.
 *
 * Like the other scripts it never reads .env files, so it cannot reach a database by accident; it prints each host's first name
 * (never a password). It only SELECTs.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { connectionStringFor } from "../lib/db-ssl";
import { artDir } from "../lib/art-store";
import { classifyArtFile, compareArt, oldEnough } from "../lib/art-orphans-core";

const yes = process.argv.includes("--yes");
const ORPHANS = "_orphans";

async function walk(root: string, rel = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(path.join(root, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!rel && entry.name === ORPHANS) continue;
      out.push(...(await walk(root, next)));
    } else if (entry.isFile()) out.push(next);
  }
  return out;
}

async function keysOf(url: string): Promise<{ host: string; keys: string[] }> {
  const pool = new Pool({ connectionString: connectionStringFor(url), ssl: { rejectUnauthorized: true } });
  try {
    const { rows } = await pool.query<{ file_key: string }>(
      `SELECT file_key FROM oracle_card_art WHERE file_key IS NOT NULL
       UNION ALL SELECT file_key FROM oracle_gallery WHERE file_key IS NOT NULL`
    );
    return { host: new URL(url).hostname.split(".")[0], keys: rows.map((r) => r.file_key) };
  } finally {
    await pool.end();
  }
}

async function main() {
  const dir = artDir();
  const urls = [process.env.DATABASE_URL, process.env.DATABASE_URL_2].filter((u): u is string => !!u?.trim());
  if (!dir) throw new Error("ART_DIR is not set in the environment.");
  if (urls.length === 0) throw new Error("DATABASE_URL is not set in the environment.");
  console.log(`Art folder: ${dir}`);

  const databases = [];
  for (const url of urls) databases.push(await keysOf(url));
  databases.forEach((d, i) => console.log(`Database ${i + 1}: ${d.host} (${d.keys.length} rows with a file)`));

  const files = await walk(dir);
  const report = compareArt(files, databases.map((d) => d.keys));
  const complete = databases.length >= 2;

  console.log(`\n${files.length} files in the folder, ${report.pictures} of them pictures.`);
  if (!complete) {
    console.log("Only ONE database was given. The dev branch and live share this folder, so the files below may belong to the other one.");
  }
  console.log(`\nPicture files with no row${complete ? "" : " in the database given"}: ${report.strays.length}`);
  for (const s of report.strays) console.log(`  ${s}`);
  report.missing.forEach((m, i) => {
    console.log(`\nRows in database ${i + 1} (${databases[i].host}) whose file is missing: ${m.length}`);
    for (const k of m) console.log(`  ${k}`);
  });
  console.log(`\nPreviews whose picture is gone: ${report.strayThumbs.length}`);
  console.log(`Half-written files (.part): ${report.parts.length}`);
  for (const p of report.parts) console.log(`  ${p}`);
  console.log(`Files not named the way the app names them (left alone): ${report.other.length}`);
  for (const o of report.other) console.log(`  ${o}`);

  if (!yes) {
    console.log("\nA report only. Nothing was changed. Add --yes (with both addresses) to move the stray pictures into _orphans.");
    return;
  }
  if (!complete) throw new Error("--yes needs both DATABASE_URL and DATABASE_URL_2: with one database a file may belong to the other.");

  let moved = 0;
  let tooNew = 0;
  const now = Date.now();
  for (const rel of report.strays) {
    const from = path.join(dir, rel);
    const stat = await fs.stat(from);
    if (!oldEnough(stat.mtimeMs, now)) {
      tooNew++;
      continue;
    }
    for (const name of [rel, `${rel}.thumb.webp`]) {
      const src = path.join(dir, name);
      const dest = path.join(dir, ORPHANS, name);
      if (classifyArtFile(name).kind === "other") continue;
      try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.rename(src, dest);
        if (name === rel) moved++;
      } catch (e: any) {
        if (e?.code !== "ENOENT") throw e;
      }
    }
  }
  console.log(`\nMoved ${moved} stray picture(s) into ${path.join(dir, ORPHANS)}; ${tooNew} left because they are less than a day old.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
