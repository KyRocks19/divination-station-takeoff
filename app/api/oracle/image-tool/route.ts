import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { MAX_SCENE_LENGTH, MAX_STYLE_LENGTH } from "@/lib/art-maker";
import { configuredImageToolUrl, enlargeToolPicture, imageToolTimeoutMs, makeToolPicture, pingImageTool, probeUpscaler } from "@/lib/image-tool";

// The picture-maker's door to the image tool on the same computer as this server (IMAGE_GEN_URL). The browser calls this
// route, never the tool itself. Signed-in people only, and only the one configured address is ever called.

const NOT_SET = "No image tool address is set up. Add IMAGE_GEN_URL to the app's environment and restart it.";

// One picture at a time: the image tool has one graphics card, and a second request would only wait behind the first.
const busy = globalThis as typeof globalThis & { __imageToolBusy?: boolean };

/** One line in the server's console for each call to the image tool, so a slow or failed picture can be looked at afterwards. */
function logCall(what: string, userId: number, started: number, result: { ok: boolean } & Partial<{ status: number; error: string }>) {
  const seconds = Math.round((Date.now() - started) / 1000);
  const outcome = result.ok ? "ok" : `FAILED ${result.status}: ${result.error}`;
  console.info(`[image-tool] ${what} for user ${userId}: ${outcome} after ${seconds}s (waits up to ${Math.round(imageToolTimeoutMs() / 1000)}s)`);
}

async function allowed(): Promise<{ userId: number } | Response> {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getPrefs(session.userId)).artHelp) {
    return Response.json({ error: "Making pictures is switched off in Settings." }, { status: 403 });
  }
  return { userId: session.userId };
}

// Is the image tool there? Used by "Test the connection".
export async function GET() {
  const who = await allowed();
  if (who instanceof Response) return who;
  const url = configuredImageToolUrl();
  if (!url) return Response.json({ error: NOT_SET }, { status: 503 });
  const result = await pingImageTool(url);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, canEnlarge: await probeUpscaler(url) });
}

// Makes one picture. Body: { prompt, form }. Answers { image: "data:image/...;base64,..." }.
// Or, with { action: "enlarge", image, factor }, makes a PNG made here larger with the tool's upscaler.
export async function POST(request: NextRequest) {
  const who = await allowed();
  if (who instanceof Response) return who;
  const url = configuredImageToolUrl();
  if (!url) return Response.json({ error: NOT_SET }, { status: 503 });

  const body = await request.json().catch(() => null);

  if (body?.action === "enlarge") {
    const factor = Number(body.factor);
    if (!Number.isInteger(factor) || factor < 2 || factor > 4) {
      return Response.json({ error: "factor must be 2, 3, or 4" }, { status: 400 });
    }
    if (busy.__imageToolBusy) {
      return Response.json({ error: "The image tool is busy with another picture. Try again in a moment." }, { status: 429 });
    }
    busy.__imageToolBusy = true;
    try {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(imageToolTimeoutMs())]);
      const started = Date.now();
      const result = await enlargeToolPicture(url, String(body.image ?? ""), factor, signal);
      logCall(`enlarge x${factor}`, who.userId, started, result);
      return result.ok ? Response.json({ image: result.value }) : Response.json({ error: result.error }, { status: result.status });
    } finally {
      busy.__imageToolBusy = false;
    }
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });
  if (prompt.length > MAX_SCENE_LENGTH + MAX_STYLE_LENGTH + 2) {
    return Response.json({ error: "That description is too long" }, { status: 400 });
  }

  if (busy.__imageToolBusy) {
    return Response.json({ error: "The image tool is busy with another picture. Try again in a moment." }, { status: 429 });
  }
  busy.__imageToolBusy = true;
  try {
    // Stops when the person presses Stop (the browser drops the request) or when the time set by IMAGE_GEN_TIMEOUT_SECONDS runs out.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(imageToolTimeoutMs())]);
    const started = Date.now();
    const result = await makeToolPicture(url, prompt, body?.form, signal);
    logCall("make", who.userId, started, result);
    return result.ok ? Response.json({ image: result.value }) : Response.json({ error: result.error }, { status: result.status });
  } finally {
    busy.__imageToolBusy = false;
  }
}
