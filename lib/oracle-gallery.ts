import { query, queryOne } from "./db";
import { MAX_UPLOAD_BYTES, limitsFor, sniffImage } from "./oracle-art";
import { artDir } from "./art-store";

// The gallery: pictures a person keeps on the site that are not on any card. Server code (it uses the database).

export interface GalleryItem {
  id: number;
  alt: string | null;
  prompt: string | null;
  made_with: string | null;
  /** The person's own tags on the picture (migration 088). */
  tags: string[];
  created_at: string;
  /** Changes when the picture does; used to refresh the browser's copy. */
  version: string;
}

/** A picture sent as a data address, checked: its bytes are a JPEG, PNG, or WebP of at most 1 MB. */
export function parseImageDataUrl(
  value: unknown,
  maxBytes: number = MAX_UPLOAD_BYTES
): { ok: true; mime: "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer } | { ok: false; status: number; error: string } {
  const match = typeof value === "string" ? /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value) : null;
  if (!match) return { ok: false, status: 400, error: "image must be a JPEG, PNG, or WebP as a data address" };
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) {
    return { ok: false, status: 413, error: `The picture must be ${Math.round(maxBytes / 1_000_000)} MB or smaller` };
  }
  const mime = sniffImage(bytes);
  if (!mime) return { ok: false, status: 415, error: "That file is not a JPEG, PNG, or WebP picture" };
  return { ok: true, mime, bytes };
}

/** The person's gallery, newest first. The pictures themselves are fetched one by one from /api/oracle/gallery/[id]. */
export async function listGallery(userId: number): Promise<GalleryItem[]> {
  return query<GalleryItem>(
    `SELECT id, alt, prompt, made_with, tags, created_at, TO_CHAR(updated_at, 'YYYYMMDDHH24MISSUS') AS version
     FROM oracle_gallery WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
    [userId]
  );
}

export async function galleryCount(userId: number): Promise<number> {
  const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM oracle_gallery WHERE user_id = $1", [userId]);
  return row?.n ?? 0;
}

/** The largest picture this copy of the app accepts: bigger when pictures are kept as files on disk. */
export function maxPictureBytes(): number {
  return limitsFor(artDir() !== null).maxBytes;
}
