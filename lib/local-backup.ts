import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLocalPool } from "./db";
import { localDbDir } from "./local-db-core";
import { queryOne } from "./db";
import { isLocked, protectBytes, unprotectBytes } from "./seal";
import { BackupInfo, BackupKind, backupName, backupsDirFor, namesToPrune, parseBackupName, sortBackups, weeklyDue } from "./local-backup-core";

// Backups of a local copy (open item ED9). A backup is one gzip file of the whole data folder, made by the running database (never by copying files
// under it), kept in "<data folder>.backups" beside it. It holds every person's writing in this copy and no secrets (the secrets file is separate), so it
// can be copied to another computer and restored there. Restoring replaces everything and first saves the current data as its own backup. Server code only.

function dirs() {
  const data = localDbDir();
  if (!data) return null;
  return { data, backups: backupsDirFor(data) };
}

/** True on a copy that keeps its data in a folder; the routes answer 404 otherwise. */
export const backupsAvailable = () => dirs() !== null;

/** The folder the backups are kept in, so the Settings card can tell the person where it is. */
export const backupsFolder = () => dirs()?.backups ?? null;

export function listBackups(): BackupInfo[] {
  const d = dirs();
  if (!d || !existsSync(/* turbopackIgnore: true */ d.backups)) return [];
  const out: BackupInfo[] = [];
  for (const name of readdirSync(/* turbopackIgnore: true */ d.backups)) {
    const parsed = parseBackupName(name);
    if (!parsed) continue;
    out.push({ name, kind: parsed.kind, madeAt: parsed.madeAt, bytes: statSync(/* turbopackIgnore: true */ join(d.backups, name)).size });
  }
  return sortBackups(out);
}

function write(folder: string, name: string, bytes: Uint8Array) {
  mkdirSync(/* turbopackIgnore: true */ folder, { recursive: true });
  // Written to a temporary name and renamed, so a stop half-way never leaves a short file that looks like a backup.
  const final = join(folder, name);
  const temporary = `${final}.tmp`;
  writeFileSync(/* turbopackIgnore: true */ temporary, bytes);
  renameSync(/* turbopackIgnore: true */ temporary, final);
}

function prune(folder: string) {
  for (const name of namesToPrune(listBackups())) rmSync(/* turbopackIgnore: true */ join(folder, name), { force: true });
}

/** Makes a backup now, from the running database. */
export async function makeBackup(kind: BackupKind = "manual", now = new Date()): Promise<BackupInfo> {
  const d = dirs();
  const pool = getLocalPool();
  if (!d || !pool) throw new Error("This copy does not keep its data in a folder.");
  // A locked copy's backups are sealed with the same key as its data (lib/seal.ts).
  const bytes = protectBytes(await pool.dump());
  const name = backupName(now, kind);
  write(d.backups, name, bytes);
  prune(d.backups);
  return { name, kind, madeAt: parseBackupName(name)!.madeAt, bytes: bytes.length };
}

/** The path of a backup by its name, or null when the name is not a backup's (this is the only way an address reaches a file). */
export function backupPath(name: string): string | null {
  const d = dirs();
  if (!d || !parseBackupName(name)) return null;
  const path = join(d.backups, name);
  return existsSync(/* turbopackIgnore: true */ path) ? path : null;
}

export function backupStream(name: string): { stream: ReadableStream; bytes: number } | null {
  const path = backupPath(name);
  if (!path) return null;
  const stream = createReadStream(/* turbopackIgnore: true */ path);
  return { stream: new ReadableStream({ start(c) { stream.on("data", (b) => c.enqueue(new Uint8Array(b as Buffer))); stream.on("end", () => c.close()); stream.on("error", (e) => c.error(e)); }, cancel() { stream.destroy(); } }), bytes: statSync(/* turbopackIgnore: true */ path).size };
}

/** Replaces everything in this copy with a backup. The current data is saved first as a "before-restore" backup, which is named in the answer. */
export async function restoreBackup(name: string, now = new Date()): Promise<{ restoredFrom: string; savedAs: string }> {
  const d = dirs();
  const pool = getLocalPool();
  const path = backupPath(name);
  if (!d || !pool || !path) throw new Error("That backup is not here.");
  const archive = unprotectBytes(new Uint8Array(readFileSync(/* turbopackIgnore: true */ path)));
  const savedAs = backupName(now, "before-restore");
  await pool.replace(archive, async (current) => write(d.backups, savedAs, protectBytes(current)));
  prune(d.backups);
  return { restoredFrom: name, savedAs };
}

/** Makes a weekly backup when one is due (see weeklyDue). Called a little after start-up; never throws. */
export async function weeklyBackupIfDue(now = new Date()): Promise<BackupInfo | null> {
  try {
    if (!dirs() || isLocked()) return null;
    const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
    if (!weeklyDue(listBackups(), now, (row?.n ?? 0) > 0)) return null;
    return await makeBackup("weekly", now);
  } catch (err) {
    console.warn(`[local-backup] weekly backup failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
