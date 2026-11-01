/**
 * Lists accounts whose usernames differ only by capitals (open item S8). Read only.
 *
 *   npx tsx scripts/check-username-case.ts [--env FILE]
 *
 * The address comes from DATABASE_URL in the environment, or else from the DATABASE_URL line of --env (default .env.local).
 * Only the host is printed, never the address. Prints "none" when sign-in can safely ignore capitals.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { connectionStringFor, sslFor } from "../lib/db-ssl";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const i = process.argv.indexOf("--env");
  const file = resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL=(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("No DATABASE_URL: set it in the environment or in the file given with --env.");
}

async function main() {
  const url = databaseUrl();
  console.log(`Host: ${new URL(url).hostname}`);
  const pool = new Pool({ connectionString: connectionStringFor(url), ssl: sslFor(url), max: 1 });
  try {
    const rows = (await pool.query(
      `SELECT LOWER(username) AS name, array_agg(username || ' (id ' || id || ')' ORDER BY id) AS accounts
       FROM users GROUP BY LOWER(username) HAVING COUNT(*) > 1`
    )).rows as { name: string; accounts: string[] }[];
    if (!rows.length) console.log("none: no two accounts differ only by capitals.");
    for (const r of rows) console.log(`${r.name}: ${r.accounts.join(", ")}`);
    process.exitCode = rows.length ? 1 : 0;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
