// Which image program a studio (or the local edition's server) talks to, and how it asks for a picture: the settings read from the environment,
// the ComfyUI workflow sent for one picture, and the reading of ComfyUI's answers. Pure: no network and no files, so the tests run it.
// The network calls are in lib/image-tool.ts. Every setting is off (the old behaviour) unless it is set.

import { NEGATIVE_PROMPT, type ImageSizeMode } from "./art-maker";

/**
 * The two kinds of image program the app can talk to:
 *  - "sdapi": the /sdapi/v1 API that KoboldCpp, AUTOMATIC1111, Forge and SD.Next all answer (the default, and the only kind before 2026-10-29);
 *  - "comfyui": ComfyUI's own API (a workflow is queued, then the finished picture is fetched).
 */
export type ImageToolKind = "sdapi" | "comfyui";

/** The words a person can write in IMAGE_GEN_KIND, each with the kind it means. */
const KIND_NAMES: Record<string, ImageToolKind> = {
  sdapi: "sdapi",
  koboldcpp: "sdapi",
  kobold: "sdapi",
  a1111: "sdapi",
  automatic1111: "sdapi",
  forge: "sdapi",
  sdnext: "sdapi",
  "sd.next": "sdapi",
  comfyui: "comfyui",
  comfy: "comfyui",
};

export interface ImageToolSettings {
  kind: ImageToolKind;
  /** "standard" (Stable Diffusion 1.5 sizes) unless IMAGE_GEN_SIZE=sdxl. */
  size: ImageSizeMode;
  /** The model file ComfyUI loads (IMAGE_GEN_MODEL, a name from its models/checkpoints folder). Not used by the sdapi kind. */
  model: string | null;
  steps: number;
  cfg: number;
  /** Settings that were written but could not be read, in plain words, so the studio's test can say so. Each one fell back to its default. */
  problems: string[];
}

export const DEFAULT_STEPS = 20;
export const DEFAULT_CFG = 7;

/** A whole number of steps from 1 to 80, or null when the text is not one. */
function cleanSteps(text: string): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 80 ? n : null;
}

/** A guidance number from 1 to 20 (tenths allowed), or null when the text is not one. */
function cleanCfg(text: string): number | null {
  const n = Number(text);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? Math.round(n * 10) / 10 : null;
}

/**
 * The image settings from the environment: IMAGE_GEN_KIND, IMAGE_GEN_SIZE, IMAGE_GEN_MODEL, IMAGE_GEN_STEPS, IMAGE_GEN_CFG. Anything unset or
 * unreadable is the default, which is what every studio did before these settings existed: KoboldCpp's API, the standard sizes, 20 steps, 7.
 */
export function readImageToolSettings(env: Record<string, string | undefined>): ImageToolSettings {
  const problems: string[] = [];
  const kindText = env.IMAGE_GEN_KIND?.trim().toLowerCase() ?? "";
  let kind: ImageToolKind = "sdapi";
  if (kindText) {
    if (KIND_NAMES[kindText]) kind = KIND_NAMES[kindText];
    else problems.push(`IMAGE_GEN_KIND=${env.IMAGE_GEN_KIND!.trim()} is not a kind this app knows. Use koboldcpp (also right for AUTOMATIC1111, Forge and SD.Next) or comfyui.`);
  }

  const sizeText = env.IMAGE_GEN_SIZE?.trim().toLowerCase() ?? "";
  let size: ImageSizeMode = "standard";
  if (sizeText === "sdxl") size = "sdxl";
  else if (sizeText && sizeText !== "standard") problems.push(`IMAGE_GEN_SIZE=${env.IMAGE_GEN_SIZE!.trim()} is not a size this app knows. Use sdxl, or leave it out for the standard sizes.`);

  const model = env.IMAGE_GEN_MODEL?.trim() || null;
  if (kind === "comfyui" && !model) problems.push("ComfyUI needs IMAGE_GEN_MODEL: the file name of the model in ComfyUI's models/checkpoints folder, for example dreamshaper_8.safetensors.");
  if (model && !/\.safetensors$/i.test(model)) problems.push(`IMAGE_GEN_MODEL=${model} does not end in .safetensors. Only .safetensors model files are safe to open (a .ckpt file can carry hidden code).`);

  const stepsText = env.IMAGE_GEN_STEPS?.trim() ?? "";
  const steps = stepsText ? cleanSteps(stepsText) : DEFAULT_STEPS;
  if (steps === null) problems.push(`IMAGE_GEN_STEPS=${stepsText} is not a whole number from 1 to 80; ${DEFAULT_STEPS} is used.`);
  const cfgText = env.IMAGE_GEN_CFG?.trim() ?? "";
  const cfg = cfgText ? cleanCfg(cfgText) : DEFAULT_CFG;
  if (cfg === null) problems.push(`IMAGE_GEN_CFG=${cfgText} is not a number from 1 to 20; ${DEFAULT_CFG} is used.`);

  return { kind, size, model, steps: steps ?? DEFAULT_STEPS, cfg: cfg ?? DEFAULT_CFG, problems };
}

/** One line for the studio's window that says how pictures will be asked for. */
export function describeSettings(s: ImageToolSettings): string {
  const kind = s.kind === "comfyui" ? `ComfyUI with ${s.model ?? "no model set"}` : "KoboldCpp's API (also AUTOMATIC1111, Forge, SD.Next)";
  const size = s.size === "sdxl" ? "SDXL sizes (about 1024 by 1024)" : "standard sizes (about 512 by 512)";
  return `${kind}, ${size}, ${s.steps} steps, guidance ${s.cfg}`;
}

/** The node in the workflow below that hands back the finished picture. */
export const COMFY_OUTPUT_NODE = "9";

/**
 * The ComfyUI workflow for one picture (ComfyUI's "API format": numbered nodes, each input either a value or [node, output]). It is ComfyUI's
 * own default text-to-picture graph, except that the last node is PreviewImage, not SaveImage: the picture goes to ComfyUI's temporary folder,
 * which it empties when it restarts, so people's pictures do not pile up in its output folder on the studio's computer.
 */
export function comfyWorkflow(o: { prompt: string; width: number; height: number; model: string; steps: number; cfg: number; seed: number }) {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: o.seed,
        steps: o.steps,
        cfg: o.cfg,
        sampler_name: "euler_ancestral",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: o.model } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: o.width, height: o.height, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: o.prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: NEGATIVE_PROMPT, clip: ["4", 1] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    [COMFY_OUTPUT_NODE]: { class_type: "PreviewImage", inputs: { images: ["8", 0] } },
  };
}

/** A seed for ComfyUI, which wants a whole number of zero or more (the sdapi kind takes -1 for "pick one"). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export interface ComfyImageRef {
  filename: string;
  subfolder: string;
  type: string;
}

/** What one look at ComfyUI's /history/<id> says: still waiting, finished with a picture, or failed (with its message). */
export type ComfyHistory = { state: "waiting" } | { state: "done"; image: ComfyImageRef } | { state: "failed"; error: string };

/** Reads ComfyUI's answer to /history/<id>. An empty answer means the picture is still queued or being made. */
export function readComfyHistory(body: unknown, promptId: string): ComfyHistory {
  const entry = body && typeof body === "object" ? (body as Record<string, any>)[promptId] : undefined;
  if (!entry || typeof entry !== "object") return { state: "waiting" };
  const status = entry.status;
  if (status?.status_str === "error") {
    const msg = Array.isArray(status.messages) ? status.messages.find((m: unknown) => Array.isArray(m) && m[0] === "execution_error")?.[1]?.exception_message : null;
    return { state: "failed", error: typeof msg === "string" && msg ? `ComfyUI could not make the picture: ${msg.slice(0, 300)}` : "ComfyUI could not make the picture." };
  }
  const images = entry.outputs?.[COMFY_OUTPUT_NODE]?.images;
  const first = Array.isArray(images) ? images[0] : null;
  if (first && typeof first.filename === "string" && first.filename) {
    return { state: "done", image: { filename: first.filename, subfolder: typeof first.subfolder === "string" ? first.subfolder : "", type: typeof first.type === "string" ? first.type : "temp" } };
  }
  // Finished but with no picture (for example the workflow was cancelled in ComfyUI's own window).
  if (status?.completed === true) return { state: "failed", error: "ComfyUI finished without a picture." };
  return { state: "waiting" };
}

/** Words for ComfyUI refusing a workflow (an answer of 400 to /prompt), most often because the model named in IMAGE_GEN_MODEL is not there. */
export function comfyRefusal(body: any, model: string): string {
  const text = JSON.stringify(body?.node_errors ?? body?.error ?? "");
  if (text.includes("ckpt_name")) return `ComfyUI has no model called ${model}. Check IMAGE_GEN_MODEL against the file names in ComfyUI's models/checkpoints folder.`;
  const said = typeof body?.error?.message === "string" ? `: ${body.error.message.slice(0, 200)}` : "";
  return `ComfyUI refused the picture${said}.`;
}

/** The model file names ComfyUI lists in its answer to /object_info/CheckpointLoaderSimple, or null when the answer is not that. */
export function comfyModelNames(body: any): string[] | null {
  const list = body?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
  return Array.isArray(list) && list.every((n) => typeof n === "string") ? list : null;
}
