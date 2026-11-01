import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { LockInfo, busyMessage, lockFileFor, lockText, lockVerdict, parseLock } from "./local-lock-core";

// Takes the lock on a local copy's data folder before PGlite opens it (open item ED9; the rules are in lib/local-lock-core.ts). A lock left by a process
// that is gone (a crash, or a program stopped by force) is taken over; one held by a running process refuses the second copy with a message that says what
// to do. The file is removed when this process exits normally. Server code only.

const held = new Map<string, LockInfo>();
let exitHooked = false;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else, which still counts as running.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function releaseOne(file: string) {
  const mine = held.get(file);
  if (!mine) return;
  held.delete(file);
  try {
    const now = parseLock(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
    // Only a lock that still says this process is removed; if another copy took it over, it is theirs.
    if (now?.pid === mine.pid) rmSync(/* turbopackIgnore: true */ file, { force: true });
  } catch {
    /* already gone */
  }
}

/** Takes the lock for `dataDir` and returns the function that gives it up. Throws the plain-words message when another running copy has it. */
export function acquireLock(dataDir: string): () => void {
  const file = lockFileFor(dataDir);
  if (held.has(file)) throw new Error(busyMessage({ ...held.get(file)! }, file));
  const info: LockInfo = { pid: process.pid, startedAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(/* turbopackIgnore: true */ file, lockText(info), { flag: "wx" });
      held.set(file, info);
      if (!exitHooked) {
        exitHooked = true;
        process.on("exit", () => { for (const f of [...held.keys()]) releaseOne(f); });
      }
      return () => releaseOne(file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const existing = existsSync(/* turbopackIgnore: true */ file) ? parseLock(readFileSync(/* turbopackIgnore: true */ file, "utf8")) : null;
      if (lockVerdict(existing, process.pid, alive) === "busy") throw new Error(busyMessage(existing, file));
      // Left over (or ours from before): remove it and try once more. If two copies race here, the second write fails with EEXIST again and is judged again.
      rmSync(/* turbopackIgnore: true */ file, { force: true });
    }
  }
  throw new Error(busyMessage(null, file));
}

/** The plain-words message when another running copy holds the lock for `dataDir`, or null when it is free (or held by this process). Takes nothing. */
export function lockBusyMessage(dataDir: string): string | null {
  const file = lockFileFor(dataDir);
  if (held.has(file) || !existsSync(/* turbopackIgnore: true */ file)) return null;
  const existing = parseLock(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
  return lockVerdict(existing, process.pid, alive) === "busy" ? busyMessage(existing, file) : null;
}
