// The server's side of the picture-maker: the app's server asks the image tool (IMAGE_GEN_URL, for example KoboldCpp on
// the same computer) for a picture. The browser never talks to the tool; it talks to /api/oracle/image-tool, which checks
// that the person is signed in and sends only fixed, checked settings. Server code only.

import { NEGATIVE_PROMPT, cleanImageToolUrl, imageSizeFor } from "./art-maker";
import http from "node:http";
import https from "node:https";
import sharp from "sharp";
import { sniffImage } from "./oracle-art";
import { FEATHERED } from "./edition";
import { comfyModelNames, comfyRefusal, comfyWorkflow, randomSeed, readComfyHistory, readImageToolSettings, type ImageToolSettings } from "./image-tool-settings";

/** Which image program is at IMAGE_GEN_URL and how to ask it (IMAGE_GEN_KIND, IMAGE_GEN_SIZE, IMAGE_GEN_MODEL, IMAGE_GEN_STEPS, IMAGE_GEN_CFG). */
export function imageToolSettings(): ImageToolSettings {
  return readImageToolSettings(process.env);
}

/** The configured image tool address, or null when none is set. */
export function configuredImageToolUrl(feathered = FEATHERED): string | null {
  // The Feathered edition has no picture maker and makes no connection (docs/plan-feathered-edition.md).
  if (feathered) return null;
  return cleanImageToolUrl(process.env.IMAGE_GEN_URL);
}

/** The largest picture the app accepts from the image tool, before the browser shrinks it (an enlarged picture can be big). */
export const MAX_TOOL_IMAGE_BYTES = 40_000_000;
/** The largest picture the app sends to the image tool to be enlarged. */
export const MAX_ENLARGE_INPUT_BYTES = 12_000_000;

/** How long the app waits for one picture or one enlargement (IMAGE_GEN_TIMEOUT_SECONDS; 15 minutes unless set, from 30 seconds to 1 hour). */
export function imageToolTimeoutMs(): number {
  const seconds = Number(process.env.IMAGE_GEN_TIMEOUT_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, Math.max(30, Math.round(seconds))) : 900) * 1000;
}

/**
 * A POST with a JSON body and a JSON answer, with no time limit of its own: the caller's signal is the only clock. This is used
 * instead of fetch() for the slow calls because fetch (undici) gives up after 5 minutes of silence whatever the caller asks,
 * and a large image model can take longer than that. Rejects with the signal's reason when the signal ends it.
 */
export function postJson(url: string, body: unknown, signal: AbortSignal, maxBytes = 80_000_000): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason ?? new Error("aborted"));
    const target = new URL(url);
    const payload = Buffer.from(JSON.stringify(body));
    const send = target.protocol === "https:" ? https.request : http.request;
    const req = send(
      target,
      { method: "POST", agent: false, headers: { "Content-Type": "application/json", "Content-Length": payload.length } },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let tooLarge = false;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            tooLarge = true;
            req.destroy(new Error("The image tool's answer was too large."));
          } else {
            chunks.push(chunk);
          }
        });
        res.on("error", reject);
        // An answer that stops before its end (the tool closed the connection) is a failure, not a short answer.
        res.on("close", () => {
          if (!res.complete) reject(new Error("The image tool closed the connection before it finished."));
        });
        res.on("end", () => {
          if (tooLarge) return reject(new Error("The image tool's answer was too large."));
          let json: any = null;
          try {
            json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            // Not JSON: left as null.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );
    const onAbort = () => req.destroy(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("close", () => signal.removeEventListener("abort", onAbort));
    req.on("error", reject);
    req.end(payload);
  });
}

/** Words for a call that ended because the caller stopped it or because the time ran out; null when it ended some other way. */
export function stoppedResult(signal: AbortSignal): { ok: false; status: number; error: string } | null {
  if (!signal.aborted) return null;
  if ((signal.reason as { name?: string } | undefined)?.name === "TimeoutError") {
    const minutes = Math.round(imageToolTimeoutMs() / 60000);
    return {
      ok: false,
      status: 504,
      error:
        `The image tool did not finish within ${minutes} minutes. It may still be working on the picture, so wait a little before trying ` +
        `again. A slow model needs a longer wait: set IMAGE_GEN_TIMEOUT_SECONDS (up to 3600) and restart the app.`,
    };
  }
  return { ok: false, status: 499, error: "Stopped." };
}

/**
 * Checks what the image tool sent back as a picture: base64 text that decodes to a real JPEG, PNG, or WebP of a sensible
 * size. Returns a data address, or null. The tool's own answer is never passed on unchecked.
 */
export function checkToolImage(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9+/=\s]+$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.length > MAX_TOOL_IMAGE_BYTES) return null;
  const mime = sniffImage(bytes);
  return mime ? `data:${mime};base64,${bytes.toString("base64")}` : null;
}

export type ToolResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const UNREACHABLE = "The app could not reach the image tool. Check that it is running and that IMAGE_GEN_URL is right.";

/** The address each kind of image program answers on when asked whether it is there. */
const PING_PATH = { sdapi: "/sdapi/v1/options", comfyui: "/system_stats" } as const;

/** Asks the image tool whether it is there. */
export async function pingImageTool(baseUrl: string, signal?: AbortSignal, settings = imageToolSettings()): Promise<ToolResult<true>> {
  try {
    const res = await fetch(`${baseUrl}${PING_PATH[settings.kind]}`, { signal: signal ?? AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, status: 502, error: `The image tool answered with an error (${res.status}).` };
    return { ok: true, value: true };
  } catch {
    return { ok: false, status: 502, error: UNREACHABLE };
  }
}

/**
 * For the studio's test: which kind of image program answers at this address, when it is not the kind that was set. Null when the set kind
 * answers, or when nothing does. Changes nothing in the program.
 */
export async function otherKindAnswering(baseUrl: string, settings = imageToolSettings()): Promise<ImageToolSettings["kind"] | null> {
  const other = settings.kind === "sdapi" ? "comfyui" : "sdapi";
  const answered = await pingImageTool(baseUrl, AbortSignal.timeout(5000), { ...settings, kind: other });
  return answered.ok ? other : null;
}

/** For the studio's test: the model files ComfyUI can load, or null when it did not say. */
export async function comfyModels(baseUrl: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${baseUrl}/object_info/CheckpointLoaderSimple`, { signal: AbortSignal.timeout(8000) });
    return res.ok ? comfyModelNames(await res.json().catch(() => null)) : null;
  } catch {
    return null;
  }
}

/** One picture from the image tool, as a data address. Only the prompt and the form's shape come from the person. */
export async function makeToolPicture(
  baseUrl: string,
  prompt: string,
  form: unknown,
  signal: AbortSignal,
  settings = imageToolSettings()
): Promise<ToolResult<string>> {
  const { width, height } = imageSizeFor(form, settings.size);
  if (settings.kind === "comfyui") return makeComfyPicture(baseUrl, prompt, width, height, settings, signal);
  let res: { status: number; json: any };
  try {
    res = await postJson(
      `${baseUrl}/sdapi/v1/txt2img`,
      { prompt, negative_prompt: NEGATIVE_PROMPT, width, height, steps: settings.steps, cfg_scale: settings.cfg, seed: -1, sampler_name: "Euler a" },
      signal
    );
  } catch {
    return stoppedResult(signal) ?? { ok: false, status: 502, error: UNREACHABLE };
  }
  if (res.status < 200 || res.status >= 300) return { ok: false, status: 502, error: `The image tool answered with an error (${res.status}).` };
  const body = res.json;
  const image = checkToolImage(body && Array.isArray(body.images) ? body.images[0] : null);
  if (!image) return { ok: false, status: 502, error: "The image tool did not send a picture back." };
  return { ok: true, value: image };
}

/** How often the app asks ComfyUI whether a picture is finished. */
export const COMFY_LOOK_MS = 1000;

/**
 * One picture from ComfyUI: the workflow is queued (/prompt), the app asks every second whether it is finished (/history/<id>), then fetches
 * the picture (/view). When the wait is stopped or runs out, the picture is taken out of ComfyUI's queue, or stopped if it is the one being made.
 */
async function makeComfyPicture(baseUrl: string, prompt: string, width: number, height: number, s: ImageToolSettings, signal: AbortSignal): Promise<ToolResult<string>> {
  if (!s.model) return { ok: false, status: 503, error: "ComfyUI needs IMAGE_GEN_MODEL set to the name of a model file in its models/checkpoints folder." };
  const workflow = comfyWorkflow({ prompt, width, height, model: s.model, steps: s.steps, cfg: s.cfg, seed: randomSeed() });
  let queued: { status: number; json: any };
  try {
    queued = await postJson(`${baseUrl}/prompt`, { prompt: workflow, client_id: "divination-station" }, signal, 1_000_000);
  } catch {
    return stoppedResult(signal) ?? { ok: false, status: 502, error: UNREACHABLE };
  }
  if (queued.status === 400) return { ok: false, status: 502, error: comfyRefusal(queued.json, s.model) };
  const promptId = typeof queued.json?.prompt_id === "string" ? queued.json.prompt_id : "";
  if (queued.status < 200 || queued.status >= 300 || !promptId) return { ok: false, status: 502, error: `The image tool answered with an error (${queued.status}).` };

  try {
    for (;;) {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => (clearTimeout(t), reject(signal.reason));
        const t = setTimeout(() => (signal.removeEventListener("abort", onAbort), resolve()), COMFY_LOOK_MS);
        signal.addEventListener("abort", onAbort, { once: true });
      });
      const res = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`, { signal });
      if (!res.ok) continue; // one bad look is not the end; the caller's clock still decides
      const seen = readComfyHistory(await res.json().catch(() => null), promptId);
      if (seen.state === "waiting") continue;
      if (seen.state === "failed") return { ok: false, status: 502, error: seen.error };
      const q = new URLSearchParams({ filename: seen.image.filename, subfolder: seen.image.subfolder, type: seen.image.type });
      const pic = await fetch(`${baseUrl}/view?${q}`, { signal });
      const bytes = Buffer.from(await pic.arrayBuffer());
      if (!pic.ok || bytes.length === 0 || bytes.length > MAX_TOOL_IMAGE_BYTES) return { ok: false, status: 502, error: "The image tool did not send a picture back." };
      const mime = sniffImage(bytes);
      if (!mime) return { ok: false, status: 502, error: "The image tool did not send a picture back." };
      return { ok: true, value: `data:${mime};base64,${bytes.toString("base64")}` };
    }
  } catch {
    if (signal.aborted) {
      await forgetComfyPicture(baseUrl, promptId);
      return stoppedResult(signal) ?? { ok: false, status: 499, error: "Stopped." };
    }
    return { ok: false, status: 502, error: UNREACHABLE };
  }
}

/** Takes a picture that is no longer wanted out of ComfyUI's queue, and stops it if it is the one being made now (and only then). */
async function forgetComfyPicture(baseUrl: string, promptId: string): Promise<void> {
  const quick = () => AbortSignal.timeout(5000);
  try {
    const queue = await fetch(`${baseUrl}/queue`, { signal: quick() }).then((r) => r.json()).catch(() => null);
    const running = Array.isArray(queue?.queue_running) && queue.queue_running.some((item: unknown) => Array.isArray(item) && item[1] === promptId);
    if (running) await fetch(`${baseUrl}/interrupt`, { method: "POST", signal: quick() });
    else await fetch(`${baseUrl}/queue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delete: [promptId] }), signal: quick() });
  } catch {
    // ComfyUI is not answering: the picture finishes on its own and is never fetched.
  }
}

/**
 * Whether the image tool has an upscaler model loaded. Asked by sending it a tiny picture: without a model it answers with an
 * empty image. Returns false when the tool cannot be reached, and for ComfyUI, whose upscaling the app does not use.
 */
export async function probeUpscaler(baseUrl: string, signal?: AbortSignal, settings = imageToolSettings()): Promise<boolean> {
  if (settings.kind !== "sdapi") return false;
  try {
    const tiny = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#808080" } }).png().toBuffer();
    const res = await fetch(`${baseUrl}/sdapi/v1/upscale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: tiny.toString("base64"), upscaling_resize: 2 }),
      signal: signal ?? AbortSignal.timeout(20_000),
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return checkToolImage(body?.image) !== null;
  } catch {
    return false;
  }
}

export const ENLARGE_NOT_SET_UP =
  "Making pictures larger needs an upscaler model in the image tool. In KoboldCpp, add one in the Image Gen tab (Upscaler) and start it again.";

/** A picture made larger by the image tool's upscaler. `image` is a PNG data address; `factor` multiplies its width and height. */
export async function enlargeToolPicture(
  baseUrl: string,
  image: string,
  factor: number,
  signal: AbortSignal,
  settings = imageToolSettings()
): Promise<ToolResult<string>> {
  if (settings.kind !== "sdapi") return { ok: false, status: 409, error: "Making pictures larger works only with KoboldCpp, AUTOMATIC1111, Forge or SD.Next, not with ComfyUI." };
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) return { ok: false, status: 400, error: "Only a PNG picture made here can be enlarged." };
  const input = Buffer.from(match[1], "base64");
  if (input.length === 0 || input.length > MAX_ENLARGE_INPUT_BYTES || sniffImage(input) !== "image/png") {
    return { ok: false, status: 400, error: "That picture cannot be enlarged." };
  }
  let res: { status: number; json: any };
  try {
    res = await postJson(`${baseUrl}/sdapi/v1/upscale`, { image: match[1], upscaling_resize: factor }, signal);
  } catch {
    return stoppedResult(signal) ?? { ok: false, status: 502, error: UNREACHABLE };
  }
  if (res.status < 200 || res.status >= 300) return { ok: false, status: 502, error: `The image tool answered with an error (${res.status}).` };
  const body = res.json;
  const enlarged = checkToolImage(body?.image);
  if (!enlarged) return { ok: false, status: 409, error: ENLARGE_NOT_SET_UP };
  // Many upscaler models only do x4 and the tool ignores the factor asked for, so the result is brought to the size asked for here.
  const fitted = await fitEnlarged(input, Buffer.from(enlarged.slice(enlarged.indexOf(",") + 1), "base64"), factor);
  return { ok: true, value: `data:image/png;base64,${fitted.toString("base64")}` };
}

/**
 * The enlarged picture at exactly `factor` times the original's size. When the upscaler made it larger than that (a x4 model asked
 * for x2), it is scaled down, which keeps more detail than enlarging directly. When it is smaller, it is left as it is.
 */
export async function fitEnlarged(original: Buffer, enlarged: Buffer, factor: number): Promise<Buffer> {
  const before = await sharp(original).metadata();
  const after = await sharp(enlarged).metadata();
  if (!before.width || !before.height || !after.width || !after.height) return enlarged;
  const width = before.width * factor;
  const height = before.height * factor;
  if (after.width <= width && after.height <= height) return enlarged;
  return sharp(enlarged).resize(width, height, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
}
