import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { localDbDir } from "./local-db-core";

// Where a portable copy keeps its data (docs/plan-feathered-edition.md 4.3): on the drive, beside the app (`my-data`, the first choice), or in a folder
// in the person's own user folder on this computer. A small file on the drive, `my-data/where.txt`, holds only the other folder's path; the start
// files read it and set DS_DATA from it (scripts/build-local-package.ts). DS_DRIVE_DATA is the drive's own `my-data`, set by the start files.
// Server code only.

export const WHERE_FILE = "where.txt";

/** Files beside the data that belong to the running app, never moved. */
const STAYS = new Set(["database.lock", WHERE_FILE]);

export type DataPlace = "drive" | "computer";

/** The drive's own data folder, or null on a copy that was not started from a portable folder's start file. */
export const driveDataDir = (): string | null => process.env.DS_DRIVE_DATA?.trim() || null;

/** The folder the data goes in when it is kept on this computer: "Divination Station" in Documents (or in the user folder when there is no Documents). */
export function computerDataDir(home = homedir()): string {
  const docs = join(home, "Documents");
  return join(existsSync(/* turbopackIgnore: true */ docs) ? docs : home, "Divination Station");
}

/** The folder the data is in now (the one that holds `database`, `pictures` and the rest). */
export function currentDataDir(): string | null {
  const db = localDbDir();
  return db ? dirname(resolve(/* turbopackIgnore: true */ db)) : null;
}

/** Where the data is now, or null when this copy cannot choose (no DS_DRIVE_DATA). */
export function dataPlace(): DataPlace | null {
  const drive = driveDataDir();
  const now = currentDataDir();
  if (!drive || !now) return null;
  return resolve(/* turbopackIgnore: true */ drive) === now ? "drive" : "computer";
}

/** True when `dir` already holds a copy's data (a sealed file or a database folder). */
export function holdsData(dir: string): boolean {
  return (
    existsSync(/* turbopackIgnore: true */ join(dir, "feathered.sealed")) ||
    existsSync(/* turbopackIgnore: true */ join(dir, "feathered.sealed.previous")) ||
    existsSync(/* turbopackIgnore: true */ join(dir, "database", "PG_VERSION"))
  );
}

/** Writes (or, for the drive, removes) the note on the drive that says where the data is. */
export function writeWhere(computerDir: string | null): void {
  const drive = driveDataDir();
  if (!drive) return;
  mkdirSync(/* turbopackIgnore: true */ drive, { recursive: true });
  const file = join(drive, WHERE_FILE);
  // One line, ended the way the computer's own start file reads lines (Windows reads it with set /p).
  if (computerDir) writeFileSync(/* turbopackIgnore: true */ file, `${computerDir}${process.platform === "win32" ? "\r\n" : "\n"}`);
  else rmSync(/* turbopackIgnore: true */ file, { force: true });
}

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const n of readdirSync(/* turbopackIgnore: true */ join(dir, rel))) {
    const r = rel ? join(rel, n) : n;
    if (!rel && STAYS.has(n)) continue;
    if (statSync(/* turbopackIgnore: true */ join(dir, r)).isDirectory()) out.push(...filesUnder(dir, r));
    else out.push(r);
  }
  return out;
}

/** Copies one named file (the secrets file, at set-up) from one data folder to another. */
export function copyDataFile(from: string, to: string, name: string): void {
  if (!existsSync(/* turbopackIgnore: true */ join(from, name))) return;
  mkdirSync(/* turbopackIgnore: true */ to, { recursive: true });
  copyFileSync(/* turbopackIgnore: true */ join(from, name), /* turbopackIgnore: true */ join(to, name));
}

/**
 * Moves the data from one folder to another, for "Move my data": every file is copied, the copies are checked (each the same size as its original),
 * and only then are the originals removed. If a copy fails or differs, the copies are removed again and the originals stay. The app must have closed
 * the database first. Returns how many files moved.
 */
export function moveData(from: string, to: string): number {
  const files = filesUnder(from);
  mkdirSync(/* turbopackIgnore: true */ to, { recursive: true });
  const made: string[] = [];
  try {
    for (const r of files) {
      mkdirSync(/* turbopackIgnore: true */ dirname(join(to, r)), { recursive: true });
      copyFileSync(/* turbopackIgnore: true */ join(from, r), /* turbopackIgnore: true */ join(to, r));
      made.push(r);
      if (statSync(/* turbopackIgnore: true */ join(to, r)).size !== statSync(/* turbopackIgnore: true */ join(from, r)).size) {
        throw new Error(`the copy of ${r} is not the same size as the original`);
      }
    }
  } catch (err) {
    for (const r of made) rmSync(/* turbopackIgnore: true */ join(to, r), { force: true });
    throw err;
  }
  // The copies are whole: the originals go (folders that are left empty too).
  for (const n of readdirSync(/* turbopackIgnore: true */ from)) {
    if (!STAYS.has(n)) rmSync(/* turbopackIgnore: true */ join(from, n), { recursive: true, force: true });
  }
  return files.length;
}
