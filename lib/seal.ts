import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { localDbDir } from "./local-db-core";
import { backupsDirFor, parseBackupName } from "./local-backup-core";
import {
  isSealed,
  isSealedArt,
  openArt,
  openSealed,
  readHeader,
  replaceHeader,
  sealArt,
  sealBytes,
  unwrapKey,
  withCodes,
  withPassphrase,
  type SealHeader,
} from "./seal-core";

// The lock on a local copy's data (docs/plan-feathered-edition.md 4.2; the file format is lib/seal-core.ts). While a copy is locked its whole database is
// one sealed file, `feathered.sealed` beside the data folder, and the database runs in memory (lib/local-db.ts). This file keeps the key while the copy
// is open, finds and writes the sealed file, and turns the backups and pictures beside it from plain to sealed and back. Server code only.
//
// The key is kept on globalThis, so every part of the server (pages, routes, the proxy) sees the same answer to "is it locked?".

interface SealState {
  dk: Buffer | null;
  header: SealHeader | null;
}
const g = globalThis as typeof globalThis & { __dsSeal?: SealState };
const state: SealState = (g.__dsSeal ??= { dk: null, header: null });

/** Thrown by the database while the copy is locked. Pages treat it as "not signed in". */
export class SealLockedError extends Error {
  readonly code = "DS_LOCKED";
  constructor() {
    super("The data is locked. Sign in to open it.");
    this.name = "SealLockedError";
  }
}
export const isLockedError = (err: unknown) => (err as { code?: string })?.code === "DS_LOCKED";

/** Where the sealed file of the data folder `dbDir` is kept: beside it, in the same folder (my-data/feathered.sealed in a portable copy). */
export const sealPathFor = (dbDir: string) => join(dirname(dbDir.replace(/[\\/]+$/, "")), "feathered.sealed");

/** True when the data folder `dbDir` has been sealed (its sealed file, or the copy kept before the last save, is there). */
export function sealFileExists(dbDir: string): boolean {
  const p = sealPathFor(dbDir);
  return existsSync(/* turbopackIgnore: true */ p) || existsSync(/* turbopackIgnore: true */ `${p}.previous`);
}

/** True on a local copy whose data is sealed. */
export function isSealedCopy(): boolean {
  const d = localDbDir();
  return !!d && sealFileExists(d);
}

/** True while a sealed copy waits for its passphrase. */
export const isLocked = () => !state.dk && isSealedCopy();

/** The data key while a sealed copy is open; null when the copy is not sealed or is locked. Pictures and backups are sealed with it. */
export const sealKey = (): Buffer | null => state.dk;
export const sealHeader = (): SealHeader | null => state.header;

/** The sealed file's bytes: the newest one, or the copy kept before the last save when the newest is missing or damaged. */
export function readSealFile(dbDir: string): Buffer {
  const p = sealPathFor(dbDir);
  for (const candidate of [p, `${p}.previous`]) {
    try {
      const bytes = readFileSync(/* turbopackIgnore: true */ candidate);
      readHeader(bytes);
      return bytes;
    } catch {
      // Try the other one.
    }
  }
  throw new Error("The sealed data file is missing or damaged.");
}

/**
 * Writes the sealed file: under a temporary name first, then the old file becomes `.previous` and the new one takes its name. A drive pulled out
 * half-way leaves either the old file or `.previous`, and readSealFile finds whichever is whole.
 */
export function writeSealFile(dbDir: string, bytes: Uint8Array): void {
  const p = sealPathFor(dbDir);
  writeFileSync(/* turbopackIgnore: true */ `${p}.tmp`, bytes);
  if (existsSync(/* turbopackIgnore: true */ p)) renameSync(/* turbopackIgnore: true */ p, `${p}.previous`);
  renameSync(/* turbopackIgnore: true */ `${p}.tmp`, p);
}

/** Removes the sealed files (after the data was opened into a folder again). */
export function removeSealFiles(dbDir: string): void {
  const p = sealPathFor(dbDir);
  for (const f of [p, `${p}.previous`, `${p}.tmp`]) rmSync(/* turbopackIgnore: true */ f, { force: true });
}

/** Keeps the key and header of an open sealed copy. */
export function adoptKey(dk: Buffer, header: SealHeader): void {
  state.dk = dk;
  state.header = header;
}

/** Forgets the key: the copy is locked until the passphrase is typed again. */
export function forgetKey(): void {
  state.dk = null;
  state.header = null;
}

function unlockWith(secret: string, kind: "pass" | "code"): boolean {
  if (state.dk) return true;
  const d = localDbDir();
  if (!d || !sealFileExists(d) || typeof secret !== "string" || !secret) return false;
  const header = readHeader(readSealFile(d));
  const key = unwrapKey(header, secret, kind);
  if (!key) return false;
  adoptKey(key, header);
  return true;
}

/** Opens a locked copy when `passphrase` is its passphrase. True when the copy is open afterwards (or was not locked). */
export const unlockWithPassphrase = (passphrase: string) => !isLocked() || unlockWith(passphrase, "pass");

/** Opens a locked copy with one of its recovery codes. */
export const unlockWithCode = (code: string) => !isLocked() || unlockWith(code, "code");

/** Every sealed file beside the data: the sealed file, the copy kept before the last save, and the backups. */
function sealedFiles(dbDir: string): string[] {
  const p = sealPathFor(dbDir);
  const out = [p, `${p}.previous`].filter((f) => existsSync(/* turbopackIgnore: true */ f));
  const backups = backupsDirFor(dbDir);
  if (existsSync(/* turbopackIgnore: true */ backups)) {
    for (const n of readdirSync(/* turbopackIgnore: true */ backups)) if (parseBackupName(n)) out.push(join(backups, n));
  }
  return out;
}

function rewrite(file: string, bytes: Uint8Array) {
  writeFileSync(/* turbopackIgnore: true */ `${file}.tmp`, bytes);
  renameSync(/* turbopackIgnore: true */ `${file}.tmp`, file);
}

/** Puts a new header on every sealed file, so the old passphrase (or a used code) opens none of them. */
function rewriteHeaders(header: SealHeader) {
  const d = localDbDir();
  if (!d) return;
  for (const f of sealedFiles(d)) {
    try {
      const bytes = readFileSync(/* turbopackIgnore: true */ f);
      if (isSealed(bytes)) rewrite(f, replaceHeader(bytes, header));
    } catch (err) {
      console.warn(`[seal] could not update ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
  state.header = header;
}

/** After `userId` changed their password: when theirs is the passphrase of this open sealed copy, the new password becomes it. */
export function passwordChanged(userId: number, password: string): void {
  if (!state.dk || !state.header || (state.header.u !== undefined && state.header.u !== userId)) return;
  rewriteHeaders(withPassphrase(state.header, state.dk, password));
}

/** After `userId` made a new set of recovery codes: they replace the old ones as ways to open the sealed data. */
export function recoveryCodesChanged(userId: number, codes: string[]): void {
  if (!state.dk || !state.header || (state.header.u !== undefined && state.header.u !== userId)) return;
  rewriteHeaders(withCodes(state.header, state.dk, codes));
}

/** After a recovery code was used: it stops opening the sealed data too. */
export function recoveryCodeUsed(code: string): void {
  if (!state.dk || !state.header) return;
  const others = state.header.wraps.filter((w) => w.kind !== "code" || !unwrapKey({ ...state.header!, wraps: [w] }, code, "code"));
  if (others.length !== state.header.wraps.length) rewriteHeaders({ ...state.header, wraps: others });
}

/** Every picture file under `dir`, previews included (not the half-written ones). */
function artFiles(dir: string): string[] {
  if (!existsSync(/* turbopackIgnore: true */ dir)) return [];
  const out: string[] = [];
  for (const n of readdirSync(/* turbopackIgnore: true */ dir)) {
    const full = join(dir, n);
    if (statSync(/* turbopackIgnore: true */ full).isDirectory()) out.push(...artFiles(full));
    else if (!n.endsWith(".part") && !n.endsWith(".tmp")) out.push(full);
  }
  return out;
}

/** Seals the backups and pictures beside the data that are still plain (when the lock is turned on). */
export function sealFilesBeside(dbDir: string, artDir: string | null, dk: Buffer, header: SealHeader): void {
  // One file at a time, each replaced whole; one that fails stays plain (and still opens), and the others go on.
  for (const f of sealedFiles(dbDir)) {
    try {
      const bytes = readFileSync(/* turbopackIgnore: true */ f);
      if (!isSealed(bytes)) rewrite(f, sealBytes(header, dk, bytes));
    } catch (err) {
      console.warn(`[seal] could not seal ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
  for (const f of artDir ? artFiles(artDir) : []) {
    try {
      const bytes = readFileSync(/* turbopackIgnore: true */ f);
      if (!isSealedArt(bytes)) rewrite(f, sealArt(dk, bytes));
    } catch (err) {
      console.warn(`[seal] could not seal ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

/** Bytes for a backup file: sealed while the copy is sealed, plain otherwise. */
export function protectBytes(plain: Uint8Array): Uint8Array {
  return state.dk && state.header ? sealBytes(state.header, state.dk, plain) : plain;
}

/** A backup file's bytes, opened when sealed. Throws when it is sealed and this copy cannot open it. */
export function unprotectBytes(bytes: Uint8Array): Uint8Array {
  if (!isSealed(bytes)) return bytes;
  if (!state.dk) throw new Error("That backup is locked, and this copy is not.");
  try {
    return new Uint8Array(openSealed(bytes, state.dk));
  } catch {
    throw new Error("That backup was locked by another copy (or with a lock that was turned off since), so this copy cannot open it.");
  }
}

/** Opens the sealed backups and pictures beside the data into plain files (when the lock is turned off). One that will not open is left as it is. */
export function openFilesBeside(dbDir: string, artDir: string | null, dk: Buffer): void {
  const p = sealPathFor(dbDir);
  for (const f of sealedFiles(dbDir)) {
    if (f === p || f === `${p}.previous`) continue;
    try {
      const bytes = readFileSync(/* turbopackIgnore: true */ f);
      if (isSealed(bytes)) rewrite(f, openSealed(bytes, dk));
    } catch (err) {
      console.warn(`[seal] could not open ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
  for (const f of artDir ? artFiles(artDir) : []) {
    try {
      const bytes = readFileSync(/* turbopackIgnore: true */ f);
      if (isSealedArt(bytes)) rewrite(f, openArt(dk, bytes));
    } catch (err) {
      console.warn(`[seal] could not open ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
