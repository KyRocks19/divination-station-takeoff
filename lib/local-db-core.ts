// The parts of the local database (lib/local-db.ts) that need no database, so the tests can run them. No imports.
//
// PGlite is Postgres in the app's own process with ONE session. The app's code asks for a "connection", runs several statements on it (a transaction)
// and gives it back, so each connection is a lease on that one session: it is held until it is given back, and the next asker waits its turn.

/** Hands out one lease at a time, in the order they were asked for. */
export class Lease {
  private tail: Promise<void> = Promise.resolve();

  /** Resolves when it is this caller's turn; the answer is the function that gives the turn up (call it exactly once). */
  async take(): Promise<() => void> {
    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    const before = this.tail;
    this.tail = before.then(() => mine);
    await before;
    let given = false;
    return () => {
      if (given) return;
      given = true;
      release();
    };
  }
}

/** The shape of an answer the app's code expects from `pg`: `rows`, and `rowCount` (PGlite calls it `affectedRows`). */
export function pgShaped<R>(result: { rows: R[]; affectedRows?: number }): { rows: R[]; rowCount: number } {
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
}

/** Whether this copy asked for its data to live in a folder on the computer (DS_DB_DIR) instead of a Postgres server. */
export function localDbDir(env: string | undefined = process.env.DS_DB_DIR): string | null {
  const dir = env?.trim();
  return dir ? dir : null;
}
