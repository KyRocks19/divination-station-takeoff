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

// PGlite's file layer (Emscripten) reports a file problem as an `ErrnoError`: an object with only `name` and a numeric `errno`, not an Error and with
// no message, so it used to reach the window as "[object Object]". These are its numbers (WASI's, not the computer's own), with plain words for each.
const FILE_ERRORS: Record<number, [code: string, words: string]> = {
  2: ["EACCES", "permission denied"],
  8: ["EBADF", "a file was closed while it was in use"],
  10: ["EBUSY", "a file is in use by another program"],
  20: ["EEXIST", "a file is already there"],
  28: ["EINVAL", "the drive refused the request"],
  29: ["EIO", "the drive could not be read or written"],
  31: ["EISDIR", "a folder is where a file should be"],
  34: ["EMLINK", "the drive does not support a file operation the database needs"],
  37: ["ENAMETOOLONG", "a file path is too long"],
  44: ["ENOENT", "a file or folder is missing"],
  51: ["ENOSPC", "the drive is full"],
  52: ["ENOSYS", "the drive does not support a file operation the database needs"],
  54: ["ENOTDIR", "a file is where a folder should be"],
  55: ["ENOTEMPTY", "a folder that should be empty is not"],
  63: ["EPERM", "the operation is not allowed"],
  69: ["EROFS", "the drive is read-only"],
  75: ["EXDEV", "a file could not be moved between drives"],
};

/** What to try for a file problem, by its code; null when there is nothing more useful to say than the problem itself. */
function fileHint(code: string): string | null {
  if (code === "EACCES" || code === "EPERM" || code === "EROFS")
    return "Check that the drive is not write-protected or read-only, and that this computer's account may change files in that folder.";
  if (code === "EBUSY") return "Another program may have the files open: a backup or sync program (OneDrive, Dropbox) or an antivirus scan. Close it, or wait, and start again.";
  if (code === "ENOSPC") return "Make room on the drive and start again.";
  if (code === "ENOENT") return "The data folder may be incomplete, for example copied while the app was running or only partly copied.";
  if (code === "EIO") return "The drive may be failing or was removed while in use.";
  if (code === "EMLINK" || code === "ENOSYS") return "Keep the data on a drive formatted as NTFS or exFAT (Settings, Move my data, or DS_DATA in settings.env).";
  return null;
}

/** Whether `err` is PGlite's file-layer error (see FILE_ERRORS). */
export function isFileError(err: unknown): err is { name: "ErrnoError"; errno: number } {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "ErrnoError" && typeof (err as { errno?: unknown }).errno === "number";
}

/** A readable one-line account of any thrown value, for the server's window: never "[object Object]". */
export function errorText(err: unknown): string {
  if (isFileError(err)) {
    const known = FILE_ERRORS[err.errno];
    return known ? `${known[1]} (${known[0]})` : `a file problem (file error number ${err.errno})`;
  }
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    return cause !== undefined && cause !== null && !err.message.includes(errorText(cause)) ? `${err.message} (${errorText(cause)})` : err.message;
  }
  if (typeof err === "object" && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      /* a value that cannot be written out: fall through */
    }
    const kind = (err as { constructor?: { name?: unknown } }).constructor?.name;
    return `an error with no message (${typeof kind === "string" && kind && kind !== "Object" ? kind : "no details"})`;
  }
  return String(err);
}

/** The message when PGlite cannot open the database at `where`: what went wrong, in plain words, and what to try. */
export function openFailureMessage(where: string, err: unknown): string {
  const what = errorText(err);
  const code = isFileError(err) ? FILE_ERRORS[err.errno]?.[0] : undefined;
  const hint = code ? fileHint(code) : null;
  return `The database in ${where} could not be opened: ${what}.${hint ? ` ${hint}` : ""}`;
}
