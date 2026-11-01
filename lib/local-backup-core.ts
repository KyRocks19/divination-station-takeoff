// Backups of a local copy's data folder (open item ED9): the names, the rotation and the "is one due" rule. No files, no database, no imports, so the
// browser and the tests use it. lib/local-backup.ts does the file work.

export const BACKUP_KINDS = ["manual", "weekly", "before-restore", "before-update"] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];

export interface BackupInfo {
  name: string;
  kind: BackupKind;
  /** ISO time the backup was made, taken from its name. */
  madeAt: string;
  bytes: number;
}

/** How many of each automatic kind are kept. A backup the person made with "Back up now" is never deleted by the app. */
export const KEEP: Record<BackupKind, number | null> = { manual: null, weekly: 7, "before-restore": 3, "before-update": 3 };
/** A weekly backup is made at start-up when the newest backup of any kind but before-restore is older than this. */
export const WEEKLY_DAYS = 7;

const NAME_RE = /^ds-backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-(manual|weekly|before-restore|before-update)\.tar\.gz$/;

/** "ds-backup-20261018T200459Z-manual.tar.gz": sorts by time as text, and says its kind. */
export function backupName(at: Date, kind: BackupKind): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp = `${p(at.getUTCFullYear(), 4)}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}T${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}Z`;
  return `ds-backup-${stamp}-${kind}.tar.gz`;
}

/** The kind and time a backup's name says, or null when it is not one of ours. This is also what keeps an address from reaching any other file. */
export function parseBackupName(name: string): { kind: BackupKind; madeAt: string } | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, kind] = m;
  const at = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return Number.isNaN(at.getTime()) ? null : { kind: kind as BackupKind, madeAt: at.toISOString() };
}

/** The folder backups are kept in: beside the data folder and named after it, like the secrets file. */
export function backupsDirFor(dataDir: string): string {
  return `${dataDir.replace(/[\\/]+$/, "")}.backups`;
}

/** Newest first. */
export function sortBackups<T extends { madeAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.madeAt < b.madeAt ? 1 : a.madeAt > b.madeAt ? -1 : 0));
}

/** The names the app may delete after a new backup: the oldest of each automatic kind beyond what is kept. */
export function namesToPrune(list: Pick<BackupInfo, "name" | "kind" | "madeAt">[]): string[] {
  const out: string[] = [];
  for (const kind of BACKUP_KINDS) {
    const keep = KEEP[kind];
    if (keep === null) continue;
    out.push(...sortBackups(list.filter((b) => b.kind === kind)).slice(keep).map((b) => b.name));
  }
  return out;
}

/** Whether a weekly backup is due: there is something worth keeping, and no backup of the person's own or a weekly one in the last WEEKLY_DAYS days. */
export function weeklyDue(list: Pick<BackupInfo, "kind" | "madeAt">[], now: Date, hasAccount: boolean): boolean {
  if (!hasAccount) return false;
  const newest = sortBackups(list.filter((b) => b.kind !== "before-restore"))[0];
  return !newest || now.getTime() - new Date(newest.madeAt).getTime() > WEEKLY_DAYS * 24 * 60 * 60 * 1000;
}

/** "12.4 MB". */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const KIND_WORDS: Record<BackupKind, string> = {
  manual: "Made by you",
  weekly: "Weekly copy",
  "before-restore": "Saved just before a restore",
  "before-update": "Saved just before an update",
};
