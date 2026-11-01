import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { query, queryOne } from "./db";
import { sealKey } from "./seal";
import { openArt, sealArt } from "./seal-core";

// Where pictures are kept. With ART_DIR set, a picture is a file on the disk of the computer that runs the app and the
// database holds only its key; without it, bytes stay in the database as before. Server code only.
//
// A key looks like '12/3f2a....png': the owner's id, a random name made here, and a type from a short list. Keys are made by
// this file and checked again before every read, write, or delete, so a stored key can never point outside ART_DIR.
// While the copy's data is locked (lib/seal.ts), every file here is sealed with the data's key: written sealed, opened on reading.
// The turbopackIgnore comments stop the build from treating these reads as a reason to copy the whole project into the
// server bundle: ART_DIR is outside the project and is never part of the build.

const KEY = /^(\d+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|json)$/;

export type ArtExt = "png" | "jpg" | "webp" | "json";

/** The folder pictures are kept in, or null when pictures stay in the database. */
export function artDir(): string | null {
  const value = process.env.ART_DIR?.trim();
  return value ? path.resolve(value) : null;
}

/**
 * True when pictures must be kept on disk (ART_REQUIRE_DISK=1) but this copy of the app has no ART_DIR, for example a hosted
 * copy. Saving a picture is refused there instead of quietly filling the database.
 */
export function diskRequiredButMissing(): boolean {
  return process.env.ART_REQUIRE_DISK === "1" && artDir() === null;
}

export const DISK_REQUIRED_MESSAGE =
  "New pictures are stored on the owner's computer, which is not reachable from here. Add pictures from that computer.";

export function extFor(mime: string): ArtExt {
  return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
}

/** True when `key` has the shape this file makes, and belongs to `userId` when one is given. */
export function validKey(key: unknown, userId?: number): key is string {
  if (typeof key !== "string") return false;
  const m = KEY.exec(key);
  return !!m && (userId === undefined || Number(m[1]) === userId);
}

/** The full path of a key inside the folder, or null when the folder is not set or the key is not one of ours. */
function pathOf(key: unknown, userId?: number): string | null {
  const dir = artDir();
  if (!dir || !validKey(key, userId)) return null;
  const full = path.resolve(dir, key);
  return full.startsWith(dir + path.sep) ? full : null;
}

/** Writes a file for `userId` and returns its key. Throws when ART_DIR is not set or the disk refuses. */
export async function writeArt(userId: number, bytes: Uint8Array, ext: ArtExt): Promise<string> {
  const dir = artDir();
  if (!dir) throw new Error("ART_DIR is not set");
  const key = `${userId}/${randomUUID()}.${ext}`;
  const full = pathOf(key, userId);
  if (!full) throw new Error("bad key");
  await fs.mkdir(path.dirname(full), { recursive: true });
  // Written under another name and renamed, so a half-written file is never seen as a picture.
  const temp = `${full}.part`;
  const k = sealKey();
  await fs.writeFile(temp, k ? sealArt(k, bytes) : bytes);
  await fs.rename(temp, full);
  return key;
}

/** The bytes of a stored picture, or null when the file is not there (or the key is not this person's). */
export async function readArt(key: unknown, userId: number): Promise<Buffer | null> {
  const full = pathOf(key, userId);
  if (!full) return null;
  try {
    return openArt(sealKey(), await fs.readFile(/*turbopackIgnore: true*/ full));
  } catch {
    return null;
  }
}

export async function artFileExists(key: unknown, userId: number): Promise<boolean> {
  const full = pathOf(key, userId);
  if (!full) return false;
  try {
    await fs.access(/*turbopackIgnore: true*/ full);
    return true;
  } catch {
    return false;
  }
}

/** Deletes stored files, quietly: a file that is already gone, or a key that is not ours, is ignored. */
export async function deleteArt(keys: (string | null | undefined)[], userId: number): Promise<void> {
  for (const key of keys) {
    const full = key ? pathOf(key, userId) : null;
    if (!full) continue;
    await fs.rm(full, { force: true }).catch(() => {});
    await fs.rm(thumbPath(full), { force: true }).catch(() => {});
  }
}

/** Where the small preview of a stored picture is kept, beside the picture. */
function thumbPath(full: string): string {
  return `${full}.thumb.webp`;
}

/** The longest side of a small preview, in pixels. */
export const THUMB_SIZE = 480;

/**
 * A small preview (WebP) of a picture, for lists and the gallery, so a page of large pictures stays light. A preview of a stored
 * file is made once and kept beside it. Returns null when the picture cannot be read as an image; the caller then sends the
 * picture itself.
 */
export async function thumbnailOf(source: Buffer, key: string | null, userId: number): Promise<Buffer | null> {
  const full = key ? pathOf(key, userId) : null;
  if (full) {
    try {
      return openArt(sealKey(), await fs.readFile(/*turbopackIgnore: true*/ thumbPath(full)));
    } catch {
      // Not made yet.
    }
  }
  let thumb: Buffer;
  try {
    thumb = await sharp(source).rotate().resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    return null;
  }
  const k = sealKey();
  if (full) await fs.writeFile(thumbPath(full), k ? sealArt(k, thumb) : thumb).catch(() => {});
  return thumb;
}

/** The files behind a person's pictures, for deleting them along with the rows. */
export async function artKeysOfUser(userId: number): Promise<string[]> {
  const rows = await query<{ file_key: string }>(
    `SELECT file_key FROM oracle_card_art WHERE user_id = $1 AND file_key IS NOT NULL
     UNION ALL SELECT file_key FROM oracle_gallery WHERE user_id = $1 AND file_key IS NOT NULL`,
    [userId]
  );
  return rows.map((r) => r.file_key);
}

/** How much picture data one person may keep in the database itself (when pictures are not files): ART_DB_BUDGET_MB, default 25. */
export function dbBudgetBytes(envValue = process.env.ART_DB_BUDGET_MB): number {
  const mb = Number(envValue);
  return (envValue !== undefined && envValue !== "" && Number.isFinite(mb) && mb >= 0 ? mb : 25) * 1_000_000;
}

/** True when `adding` more bytes still fits in the budget. */
export function withinBudget(used: number, adding: number, budget = dbBudgetBytes()): boolean {
  return used + adding <= budget;
}

/** Raised when a picture would take a person over their share of the database. */
export class ArtBudgetError extends Error {
  readonly status = 413;
  constructor(budget: number) {
    super(`You have used your ${Math.round(budget / 1_000_000)} MB of picture space on this site. Delete a picture or two (from your gallery or an item) to make room.`);
    this.name = "ArtBudgetError";
  }
}

/**
 * Before a picture is kept in the database itself (no ART_DIR): throws ArtBudgetError when it would take the person over their
 * share. The database is shared by everyone and small, so each person has a share of it. Pictures kept as files are not counted.
 */
export async function ensureRoom(userId: number, adding: number): Promise<void> {
  if (artDir()) return;
  const row = await queryOne<{ used: string }>(
    `SELECT (COALESCE((SELECT SUM(octet_length(data)) FROM oracle_card_art WHERE user_id = $1), 0)
           + COALESCE((SELECT SUM(octet_length(data)) FROM oracle_gallery WHERE user_id = $1), 0))::text AS used`,
    [userId]
  );
  if (!withinBudget(Number(row?.used ?? 0), adding)) throw new ArtBudgetError(dbBudgetBytes());
}

/**
 * Where a new picture's bytes go: a file when ART_DIR is set, otherwise the row. Returns what to put in the row's
 * `data` and `file_key` columns. The caller deletes the file again if the row cannot be saved.
 */
export async function placeBytes(userId: number, bytes: Buffer, mime: string): Promise<{ data: Buffer | null; file_key: string | null }> {
  if (!artDir()) return { data: bytes, file_key: null };
  return { data: null, file_key: await writeArt(userId, bytes, extFor(mime)) };
}

/** The bytes of a row's picture, wherever they are kept; null when they are not reachable now. */
export async function bytesOfRow(row: { data: Buffer | null; file_key: string | null }, userId: number): Promise<Buffer | null> {
  if (row.data) return row.data;
  return row.file_key ? readArt(row.file_key, userId) : null;
}
