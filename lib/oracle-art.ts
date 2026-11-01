// Art for a card, stone, stave, or charm (slice 3). No database code, so the browser can import it.
//
// Two kinds of art, both optional, both replaceable and removable at any time:
//  - a drawing made in the app: kept as strokes (so it can be opened and changed again) and drawn as an SVG;
//  - an uploaded picture: a JPEG, PNG, or WebP that the browser shrinks before sending. SVG files are refused on
//    purpose: a picture someone uploads must never be able to carry a script.

import { cleanForm, type SetForm } from "./oracle-forms";

export type ArtKind = "drawing" | "upload";

/** The drawing board for each form, in board units. The picture is shown at this shape. */
export const BOARD_SIZE: Record<SetForm, { w: number; h: number }> = {
  cards: { w: 360, h: 504 },
  stones: { w: 480, h: 480 },
  staves: { w: 120, h: 504 },
  charms: { w: 480, h: 480 },
};

export function boardFor(form: unknown): { w: number; h: number } {
  return BOARD_SIZE[cleanForm(form) ?? "cards"];
}

/** Round shapes are shown clipped to a circle; the others keep their corners softly rounded. */
export function isRound(form: unknown): boolean {
  const f = cleanForm(form) ?? "cards";
  return f === "stones" || f === "charms";
}

/** Colours for the pen. Plain hex, so a saved drawing looks the same in every theme. */
export const PEN_COLORS = [
  "#f5f3ff", "#1a1a2e", "#ff40de", "#fd82f0", "#a855f7", "#6366f1",
  "#38bdf8", "#34d399", "#facc15", "#fb923c", "#ef4444", "#92400e",
];
export const BACKGROUND_COLORS = ["#1a1a2e", "#f5f3ff", "#3b0764", "#082f49", "#052e16", "#451a03"];
export const PEN_SIZES = [3, 8, 18];

export const MAX_STROKES = 600;
export const MAX_POINTS_PER_STROKE = 3000;
export const MAX_STROKES_JSON = 600_000;
export const MAX_UPLOAD_BYTES = 1_000_000;
/**
 * What one picture may weigh and measure. Pictures kept in the database stay small (1 MB); pictures kept as files on the
 * owner's disk (ART_DIR) may be much larger, so enlarged pictures keep their detail.
 */
export const DISK_MAX_BYTES = 10_000_000;
export const DB_LONGEST = 1000;
export const DISK_LONGEST = 2400;

export interface ArtLimits {
  /** The most bytes one picture may have. */
  maxBytes: number;
  /** The most pixels on the long side after the browser shrinks a picture. */
  longest: number;
}

export function limitsFor(onDisk: boolean): ArtLimits {
  return onDisk ? { maxBytes: DISK_MAX_BYTES, longest: DISK_LONGEST } : { maxBytes: MAX_UPLOAD_BYTES, longest: DB_LONGEST };
}
export const MAX_ALT_LENGTH = 300;
/** How many pictures one person can keep in the gallery (each is at most 1 MB, so at most about 100 MB). */
export const MAX_GALLERY_ITEMS = 100;
export const MAX_PROMPT_LENGTH = 1300;

export interface Stroke {
  /** Pen colour, six-digit hex. */
  c: string;
  /** Pen width in board units. */
  w: number;
  /** Points in board units. */
  p: [number, number][];
}

export interface Drawing {
  background: string;
  strokes: Stroke[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A checked drawing, or an error saying what is wrong with it. */
export function cleanDrawing(raw: unknown, form: unknown): { ok: true; drawing: Drawing } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "A drawing is needed" };
  const { background, strokes } = raw as { background?: unknown; strokes?: unknown };
  if (typeof background !== "string" || !HEX.test(background)) return { ok: false, error: "background must be a six-digit hex colour" };
  if (!Array.isArray(strokes)) return { ok: false, error: "strokes must be a list" };
  if (strokes.length > MAX_STROKES) return { ok: false, error: `A drawing can have at most ${MAX_STROKES} strokes` };
  const { w, h } = boardFor(form);
  const out: Stroke[] = [];
  for (const s of strokes) {
    if (!s || typeof s !== "object") return { ok: false, error: "Each stroke must be an object" };
    const { c, w: width, p } = s as { c?: unknown; w?: unknown; p?: unknown };
    if (typeof c !== "string" || !HEX.test(c)) return { ok: false, error: "Each stroke needs a six-digit hex colour" };
    if (typeof width !== "number" || !(width >= 1 && width <= 40)) return { ok: false, error: "A stroke's width must be from 1 to 40" };
    if (!Array.isArray(p) || p.length < 1 || p.length > MAX_POINTS_PER_STROKE) return { ok: false, error: "A stroke needs 1 to 3000 points" };
    const points: [number, number][] = [];
    for (const pt of p) {
      if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[0] !== "number" || typeof pt[1] !== "number" ||
          !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
        return { ok: false, error: "Each point must be two numbers" };
      }
      // Anything off the board is pulled back onto it.
      points.push([Math.round(Math.min(w, Math.max(0, pt[0])) * 10) / 10, Math.round(Math.min(h, Math.max(0, pt[1])) * 10) / 10]);
    }
    out.push({ c: c.toLowerCase(), w: Math.round(width * 10) / 10, p: points });
  }
  const drawing = { background: background.toLowerCase(), strokes: out };
  if (JSON.stringify(drawing).length > MAX_STROKES_JSON) return { ok: false, error: "That drawing is too large to save" };
  return { ok: true, drawing };
}

/** The SVG path for one stroke: a dot for a single point, otherwise a smooth line through the points. */
export function strokePath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${x} ${y}l0.01 0`;
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d += `Q${x0} ${y0} ${Math.round(((x0 + x1) / 2) * 10) / 10} ${Math.round(((y0 + y1) / 2) * 10) / 10}`;
  }
  const last = points[points.length - 1];
  return d + `L${last[0]} ${last[1]}`;
}

/** A drawing as a stand-alone SVG document. Only checked numbers and hex colours go into it. */
export function drawingToSvg(drawing: Drawing, form: unknown): string {
  const { w, h } = boardFor(form);
  const paths = drawing.strokes
    .map((s) => `<path d="${strokePath(s.p)}" stroke="${s.c}" stroke-width="${s.w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${drawing.background}"/>${paths}</svg>`
  );
}

/** What kind of picture some bytes are, by their first bytes, or null when they are none of the allowed three. */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

/**
 * The file name offered when a picture is downloaded (`?download=1` on the picture routes). It is made up here from the kind, the number and the
 * type of the picture, never from anything the person typed, so it can hold no path, no quote and no odd character.
 */
export function downloadName(source: "gallery" | "item", id: number, mime: string): string {
  const n = Number.isInteger(id) && id > 0 ? id : 0;
  return `divination-station-${source}-${n}.${EXTENSIONS[mime.split(";")[0].trim()] ?? "bin"}`;
}

/** The header that makes the browser save the picture instead of showing it. */
export const attachmentHeader = (name: string) => `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, "_")}"`;

export function cleanAlt(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_ALT_LENGTH) : null;
}
