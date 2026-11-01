/**
 * Measures how the database answers from this computer (open item P7), so a change to the pool can be judged by numbers. Read-only: it
 * runs `SELECT 1` and `SELECT pg_sleep(...)` and changes nothing.
 *
 *   export DATABASE_URL=...   (from .env.development.local; the script never reads .env files)
 *   npx tsx scripts/measure-db.ts [--allow-live]
 *
 * It prints the host first and stops unless it is your dev database (scripts/dev-database.ts), because a measure of the live database is for the
 * owner to choose. Numbers vary with the time of day and with Neon waking up: run it twice and look at the second run.
 */

import { Pool } from "pg";
import { isDevDatabase } from "./dev-database";
import { connectionStringFor, sslFor } from "../lib/db-ssl";

const url = process.env.DATABASE_URL ?? "";
const host = url.replace(/.*@([^/:?]+).*/, "$1");
console.log(`Host: ${host || "(none: set DATABASE_URL)"}`);
if (!url) process.exit(1);
if (!isDevDatabase(host) && !process.argv.includes("--allow-live")) {
  console.log("That is not the dev branch. Stopping. Add --allow-live only if you mean to measure the live database (read-only).");
  process.exit(1);
}

const make = (max: number) =>
  new Pool({ connectionString: connectionStringFor(url), ssl: sslFor(url), max, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 30_000, keepAlive: true });

const ms = (t0: number) => Math.round(performance.now() - t0);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  // A new connection each time: what a page pays when no connection is waiting in the pool.
  const cold: number[] = [];
  for (let i = 0; i < 5; i++) {
    const pool = make(1);
    const t0 = performance.now();
    await pool.query("SELECT 1");
    cold.push(ms(t0));
    await pool.end();
  }
  console.log(`New connection + SELECT 1, 5 times: ${cold.join(", ")} ms (median ${median(cold)})`);

  // A connection already open: what a page pays when the pool has one ready.
  const pool = make(5);
  await pool.query("SELECT 1");
  const warm: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await pool.query("SELECT 1");
    warm.push(ms(t0));
  }
  console.log(`SELECT 1 on an open connection, 20 times: median ${median(warm)} ms, slowest ${Math.max(...warm)} ms`);
  await pool.end();

  // A page that asks for 20 things at once (each takes about 50 ms in the database), with different pool sizes.
  for (const max of [2, 5, 10, 20]) {
    const p = make(max);
    await p.query("SELECT 1"); // one open connection to begin with; the others are opened as needed
    const t0 = performance.now();
    await Promise.all(Array.from({ length: 20 }, () => p.query("SELECT pg_sleep(0.05)")));
    console.log(`20 queries at once, pool of ${String(max).padStart(2)}: ${ms(t0)} ms`);
    await p.end();
  }
}

main().catch((err) => {
  console.error("measure-db FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
