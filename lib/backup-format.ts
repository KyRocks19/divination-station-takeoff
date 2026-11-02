// The parts of the backup and restore scripts that need no database, so they can be tested.

export const BACKUP_FORMAT = "divination-station-backup-1";

/** Which part of a database address names the server, for showing on screen and for the restore guard. Never the password. */
export function hostOf(url: string | undefined): string {
  if (!url) return "(none)";
  try {
    return new URL(url).hostname;
  } catch {
    return "(unreadable address)";
  }
}

export { sslFor } from "./db-ssl";

/**
 * Tables in an order where every table comes after the tables it points to, so rows can be put back without a "parent
 * missing" error. `foreignKeys` lists each (child, parent) pair; a table pointing at itself is ignored. Ties keep
 * alphabetical order so the result is the same every time. Throws when the tables point at each other in a circle.
 */
export function tableOrder(tables: string[], foreignKeys: { child: string; parent: string }[]): string[] {
  const names = new Set(tables);
  const waitingFor = new Map<string, Set<string>>();
  for (const t of tables) waitingFor.set(t, new Set());
  for (const { child, parent } of foreignKeys) {
    if (child !== parent && names.has(child) && names.has(parent)) waitingFor.get(child)!.add(parent);
  }
  const order: string[] = [];
  const remaining = new Set(tables);
  while (remaining.size > 0) {
    const ready = [...remaining].filter((t) => [...waitingFor.get(t)!].every((p) => !remaining.has(p))).sort();
    if (ready.length === 0) throw new Error(`Tables point at each other in a circle: ${[...remaining].sort().join(", ")}`);
    for (const t of ready) {
      order.push(t);
      remaining.delete(t);
    }
  }
  return order;
}

/**
 * The fields of a backed-up row that the target table has no column for. The restore fills rows with json_populate_recordset,
 * which quietly skips fields it has no column for, so without this check a restore into an older schema would lose data
 * while reporting success.
 */
export function fieldsWithoutColumn(rowFields: string[], tableColumns: string[]): string[] {
  const have = new Set(tableColumns);
  return rowFields.filter((f) => !have.has(f)).sort();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** divination-station-2026-10-13-0930.jsonl.gz, in the computer's own time. */
export function backupFileName(when: Date): string {
  return `divination-station-${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}.jsonl.gz`;
}

/** The time a backup file name stands for, or null when the name is not one of ours. */
export function parseBackupName(name: string): Date | null {
  const m = /^divination-station-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.jsonl\.gz$/.exec(name);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** A key that is the same for every day of one calendar week (weeks start on Monday). */
function weekKey(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

/**
 * Which backup files to keep: the newest `recent` of them, plus the newest file of each of the latest `weeks` calendar weeks.
 * Names that are not backup names are never listed for removal.
 */
export function filesToKeep(names: string[], recent = 14, weeks = 8): Set<string> {
  const dated = names
    .map((name) => ({ name, when: parseBackupName(name) }))
    .filter((x): x is { name: string; when: Date } => x.when !== null)
    .sort((a, b) => b.when.getTime() - a.when.getTime());
  const keep = new Set(dated.slice(0, recent).map((x) => x.name));
  const seenWeeks = new Set<string>();
  for (const x of dated) {
    const k = weekKey(x.when);
    if (seenWeeks.has(k)) continue;
    if (seenWeeks.size >= weeks) break;
    seenWeeks.add(k);
    keep.add(x.name);
  }
  return keep;
}

/** The backup names that may be deleted: backup-shaped names not in the keep set. */
export function filesToRemove(names: string[], recent = 14, weeks = 8): string[] {
  const keep = filesToKeep(names, recent, weeks);
  return names.filter((n) => parseBackupName(n) !== null && !keep.has(n));
}

export interface BackupHeader {
  format: typeof BACKUP_FORMAT;
  created: string;
  host: string;
  migrations: string[];
  tables: { name: string; rows: number }[];
}

/** Migrations the backup's database has had that this copy's migrations folder does not have: the data is newer than this copy of the app. */
export function newerThanThisCopy(backupMigrations: string[], localMigrations: string[]): string[] {
  const have = new Set(localMigrations);
  return backupMigrations.filter((m) => !have.has(m)).sort();
}
