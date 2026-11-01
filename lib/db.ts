import { Pool, PoolClient } from "pg";
import { connectionStringFor, sslFor } from "./db-ssl";
import { READ_RETRY_DELAYS_MS, isConnectionError, poolMax } from "./db-retry-core";
import { localDbDir } from "./local-db-core";
import { makeLocalPool, type LocalPool } from "./local-db";

// One pool for the whole server process. It is kept on globalThis so that the dev server, which loads this
// file again after an edit, goes on using the same pool instead of opening a second one. (That also means a
// change to the settings below needs a restart of the dev server to take effect.)
const globalForDb = globalThis as typeof globalThis & { __stationPool?: Pool };

export function getPool(): Pool {
  // The full local edition keeps its data in a folder on the computer (DS_DB_DIR, lib/local-db.ts) and answers like a pool would.
  const localDir = localDbDir();
  if (localDir && !globalForDb.__stationPool) {
    globalForDb.__stationPool = makeLocalPool(localDir, process.env.DS_MIGRATIONS_DIR?.trim() || undefined) as unknown as Pool;
  }
  if (!globalForDb.__stationPool) {
    const pool = new Pool({
      connectionString: connectionStringFor(process.env.DATABASE_URL),
      ssl: sslFor(process.env.DATABASE_URL ?? ""),
      // Keep a connection for 30 seconds after its last use (pg's own default is 10). Opening a new connection
      // is the step that sometimes fails, so moving from page to page should not have to do it every time.
      idleTimeoutMillis: 30_000,
      // Give up on one attempt to connect after 10 seconds instead of waiting for ever; acquire() tries again.
      connectionTimeoutMillis: 10_000,
      // At most this many connections from this server (DB_POOL_MAX, 10 unless set). Lower it if Neon refuses connections when
      // several servers run at once; a page that asks for many things at once then waits its turn instead of opening more.
      max: poolMax(),
      // Let the operating system notice a connection that died while it sat unused.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    // A connection can break while it sits unused in the pool. The pool drops it by itself; without this
    // listener Node would treat the event as an uncaught error.
    pool.on("error", (err) => console.warn(`[db] dropped an unused connection: ${err.message}`));
    globalForDb.__stationPool = pool;
  }
  return globalForDb.__stationPool;
}

/** Puts another local database in place of the current one (set-up keeping a new copy's data in a folder on this computer, lib/data-place.ts). */
export function setLocalPool(pool: LocalPool): void {
  globalForDb.__stationPool = pool as unknown as Pool;
}

/** The local edition's database (for backup and restore), or null on a copy that uses a Postgres server. */
export function getLocalPool(): LocalPool | null {
  return localDbDir() ? (getPool() as unknown as LocalPool) : null;
}

// How long to wait before each further attempt to get a connection, in milliseconds. Three attempts in all.
const ACQUIRE_RETRY_DELAYS_MS = [150, 500];

/**
 * Takes a connection from the pool, trying again when that fails. Opening a new connection to Neon sometimes
 * fails for a moment ("Connection terminated unexpectedly", "Authentication timed out"). No statement has
 * been sent at that point, so trying again can never run anything twice. A statement that fails after it was
 * sent is not retried here, because it may already have run.
 */
async function acquire(): Promise<PoolClient> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPool().connect();
    } catch (err) {
      // A locked local copy (lib/seal.ts) stays locked however often it is asked.
      if (attempt >= ACQUIRE_RETRY_DELAYS_MS.length || (err as { code?: string })?.code === "DS_LOCKED") throw err;
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[db] could not get a connection (${reason}); trying again`);
      await new Promise((resolve) => setTimeout(resolve, ACQUIRE_RETRY_DELAYS_MS[attempt]));
    }
  }
}

/**
 * Runs `fn` with a connection from the pool and gives the connection back afterwards.
 * `closeOnFailure` closes the connection instead of putting it back when `fn` fails.
 */
async function withClient<T>(closeOnFailure: boolean, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquire();
  // While a connection is in use the pool does not listen for its errors. Without a listener, a connection
  // that drops in the middle of a statement would be an uncaught error for the whole server. The statement
  // still fails with that same error, and that is what the caller sees.
  const onError = () => {};
  client.on("error", onError);
  let failed = false;
  try {
    return await fn(client);
  } catch (err) {
    failed = true;
    throw err;
  } finally {
    client.removeListener("error", onError);
    client.release(closeOnFailure && failed ? true : undefined);
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  // As pool.query() does: a connection whose statement failed is closed, not put back.
  return withClient(true, async (client) => {
    const { rows } = await client.query(sql, params);
    return rows as T[];
  });
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Like `query`, for a statement that only reads: if the connection fails in the middle of it, it is tried again (twice at most), because a
 * read cannot run twice with a different result. It is chosen by the caller, never guessed from the SQL: a `WITH ... INSERT` or a function
 * that writes starts like a read. Use it only for a plain SELECT. An error that is not about the connection (a wrong column, a refused
 * statement) is thrown at once.
 */
export async function queryRead<T = any>(sql: string, params?: any[]): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await query<T>(sql, params);
    } catch (err) {
      if (attempt >= READ_RETRY_DELAYS_MS.length || !isConnectionError(err)) throw err;
      console.warn(`[db] a read lost its connection (${err instanceof Error ? err.message : err}); trying again`);
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]));
    }
  }
}

export async function queryReadOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await queryRead<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(false, async (client) => {
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      // If the connection itself is gone the rollback fails too; the database has already undone the work,
      // and the first error is the one worth reporting.
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

// --- Settings helpers ---
export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, value]
  );
}

// --- Card draw tracking ---
export interface LogCardDrawParams {
  userId: number;
  readingId: number;
  cardId: string;
  cardName: string;
  positionName: string;
  spreadName: string;
  reversed: boolean;
  isClarifier?: boolean;
  clarifiesCardId?: string;
  clarifiesPosition?: string;
}

export async function logCardDraw(params: LogCardDrawParams): Promise<void> {
  await query(
    `INSERT INTO card_draws
       (user_id, reading_id, card_id, card_name, position_name, spread_name,
        reversed, is_clarifier, clarifies_card_id, clarifies_position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.userId,
      params.readingId,
      params.cardId,
      params.cardName,
      params.positionName,
      params.spreadName,
      params.reversed ? 1 : 0,
      params.isClarifier ? 1 : 0,
      params.clarifiesCardId ?? null,
      params.clarifiesPosition ?? null,
    ]
  );
}
