// The one-process rule of a local copy's data folder (open item ED9): PGlite opens a folder from one process at a time, and two processes writing to
// it would damage it. The running copy keeps a small lock file beside the folder; these are the parts that decide what a lock file means.
// No files and no imports, so the tests use it. lib/local-lock.ts does the file work.

export interface LockInfo {
  pid: number;
  /** ISO time the copy that holds the lock started. */
  startedAt: string;
}

/** The lock file for a data folder: beside it and named after it, like the secrets file and the backups folder. */
export function lockFileFor(dataDir: string): string {
  return `${dataDir.replace(/[\\/]+$/, "")}.lock`;
}

export function lockText(info: LockInfo): string {
  return JSON.stringify(info);
}

/** The lock a file's text describes, or null when it is not one (an unreadable lock is treated as left over). */
export function parseLock(text: string): LockInfo | null {
  try {
    const raw = JSON.parse(text) as Partial<LockInfo>;
    return typeof raw.pid === "number" && Number.isInteger(raw.pid) && raw.pid > 0 && typeof raw.startedAt === "string" ? { pid: raw.pid, startedAt: raw.startedAt } : null;
  } catch {
    return null;
  }
}

/**
 * What an existing lock means for a copy that wants the folder:
 * - "busy": another running process holds it, so this one must not open the folder;
 * - "left over": nobody holds it any more (unreadable, or the process is gone), so this one may take it;
 * - "ours": this process wrote it (a copy restarted in the same process), so it may be taken again.
 */
export function lockVerdict(existing: LockInfo | null, ownPid: number, isAlive: (pid: number) => boolean): "busy" | "left over" | "ours" {
  if (!existing) return "left over";
  if (existing.pid === ownPid) return "ours";
  return isAlive(existing.pid) ? "busy" : "left over";
}

/** What the person is told when the folder is already open. Plain words, and how to carry on if the lock is wrong. */
export function busyMessage(info: LockInfo | null, lockFile: string): string {
  const who = info ? `another copy of the app (process ${info.pid}, started ${info.startedAt.slice(0, 16).replace("T", " ")} UTC)` : "another copy of the app";
  return `This data folder is already open in ${who}. Only one copy can use it at a time, because two would damage it. Close the other one first. If you are sure nothing else is using it, delete the file ${lockFile} and start again.`;
}
