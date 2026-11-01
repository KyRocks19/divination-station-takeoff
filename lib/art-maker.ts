// The picture-maker's shared pieces: the person's own words made into a prompt, picture sizes, and the browser's calls to
// the app's own /api/oracle/image-tool route. No database code and no server-only code, so the browser imports it. The
// app's server (lib/image-tool.ts) is what talks to the image tool on its own computer (IMAGE_GEN_URL, for example
// KoboldCpp); the browser never does.

import { cleanForm, type SetForm } from "./oracle-forms";

/** The value stored in `made_with` for a picture made by the picture-maker. */
export const LOCAL_IMAGE_TOOL = "local-image-tool";
export const MADE_WITH_LABELS: Record<string, string> = {
  [LOCAL_IMAGE_TOOL]: "Made with an image tool on your own computer",
};

export function cleanMadeWith(value: unknown): string | null {
  return typeof value === "string" && value in MADE_WITH_LABELS ? value : null;
}

export const MAX_BATCH = 35;
export const DEFAULT_BATCH = 7;
export { MAX_SCENE_LENGTH } from "./art-scene";
export const MAX_STYLE_LENGTH = 500;
/** Words that only keep out text and smudges. They are technical, carry no meaning, and are shown to the person. */
export const NEGATIVE_PROMPT = "text, letters, watermark, signature, blurry, deformed";

/** Picture sizes the image tool is asked for, each a multiple of 64 and close to the shape of the form. */
export const IMAGE_SIZE: Record<SetForm, { width: number; height: number }> = {
  cards: { width: 512, height: 704 },
  stones: { width: 512, height: 512 },
  staves: { width: 192, height: 768 },
  charms: { width: 512, height: 512 },
};

/**
 * The same shapes at an SDXL model's own size, about a million pixels each, from the sizes SDXL models were trained on. An SDXL model asked
 * for the smaller sizes above draws worse pictures; asked for these, it draws better ones but takes longer. A studio chooses this with
 * IMAGE_GEN_SIZE=sdxl (lib/image-tool.ts); it is off unless set.
 */
export const SDXL_IMAGE_SIZE: Record<SetForm, { width: number; height: number }> = {
  cards: { width: 832, height: 1152 },
  stones: { width: 1024, height: 1024 },
  staves: { width: 512, height: 2048 },
  charms: { width: 1024, height: 1024 },
};

/** The picture sizes a studio can ask for: "standard" (the sizes above, right for Stable Diffusion 1.5) or "sdxl". */
export type ImageSizeMode = "standard" | "sdxl";

export function imageSizeFor(form: unknown, mode: ImageSizeMode = "standard"): { width: number; height: number } {
  return (mode === "sdxl" ? SDXL_IMAGE_SIZE : IMAGE_SIZE)[cleanForm(form) ?? "cards"];
}

/** Whole number from 1 to MAX_BATCH; anything else becomes the default. */
export function cleanBatch(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= MAX_BATCH ? n : DEFAULT_BATCH;
}

/** An address for the image tool: http or https only, no trailing slash, or null. */
export function cleanImageToolUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** The full prompt sent: the person's scene, then the composition hint if they kept it on, then their style note. */
export function joinPrompt(scene: string, style: string, composition = ""): string {
  return [scene.trim(), composition.trim(), style.trim()].filter(Boolean).join(", ");
}

/** A suggested description for a screen reader, made from the person's own scene. They edit it before saving. */
export function suggestAlt(scene: string, max = 300): string {
  const text = scene.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

/** `canEnlarge` is whether the image tool has an upscaler model loaded (the "Make larger" button needs one). */
export type ToolCheck = { ok: true; canEnlarge: boolean } | { ok: false; message: string };

/** Enlarging factors offered: the picture's width and height are multiplied by this. */
export const ENLARGE_FACTORS = [2, 4] as const;

/** A failure of the image tool or the app's door to it, with the HTTP status (0 when the app itself could not be reached). */
export class ImageToolError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ImageToolError";
  }
}

/**
 * After a failed picture, whether the next one is worth trying. A signed-out person, a switched-off setting, a missing address,
 * a busy tool, a timeout, or a stop will not be different a moment later; a one-off error from the tool might be.
 */
export function shouldGoOn(status: number): boolean {
  return ![401, 403, 429, 499, 503, 504].includes(status);
}

/** How many failures in a row end a batch, so a broken tool is not asked ten times. */
export const MAX_FAILURES_IN_A_ROW = 2;

async function errorWords(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" && body.error ? body.error : `${fallback} (${res.status}).`;
}

/** Asks the app to check that the image tool is there. The app's server makes the call, not the browser. */
export async function testImageTool(signal?: AbortSignal): Promise<ToolCheck> {
  try {
    const res = await fetch("/api/oracle/image-tool", { signal });
    if (!res.ok) return { ok: false, message: await errorWords(res, "The image tool check failed") };
    const body = await res.json().catch(() => null);
    return { ok: true, canEnlarge: body?.canEnlarge === true };
  } catch {
    return { ok: false, message: "Could not reach the app. Check your connection and try again." };
  }
}

export interface MakeOptions {
  prompt: string;
  form: unknown;
  signal?: AbortSignal;
}

/** One picture from the image tool, as a data address, made by the app's server. Throws an Error with words the person can read. */
export async function makePicture({ prompt, form, signal }: MakeOptions): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/oracle/image-tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, form }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ImageToolError("Could not reach the app. Check your connection and try again.", 0);
  }
  if (!res.ok) throw new ImageToolError(await errorWords(res, "The picture could not be made"), res.status);
  const body = await res.json().catch(() => null);
  if (typeof body?.image !== "string" || !body.image.startsWith("data:image/")) throw new ImageToolError("No picture came back.", 502);
  return body.image;
}

/** A picture made larger by the image tool's upscaler (done by the app's server). Throws an Error with words the person can read. */
export async function enlargePicture({ image, factor, signal }: { image: string; factor: number; signal?: AbortSignal }): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/oracle/image-tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enlarge", image, factor }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ImageToolError("Could not reach the app. Check your connection and try again.", 0);
  }
  if (!res.ok) throw new ImageToolError(await errorWords(res, "The picture could not be enlarged"), res.status);
  const body = await res.json().catch(() => null);
  if (typeof body?.image !== "string" || !body.image.startsWith("data:image/")) throw new ImageToolError("No picture came back.", 502);
  return body.image;
}
