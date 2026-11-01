// The picture studio's test, run with `--check` (scripts/image-worker.ts). It looks at the settings, asks the website whether the token is
// accepted (a call that changes nothing, so it is safe while a studio is running), asks the image program whether it answers, and with
// `--picture` makes one test picture and throws it away. Prints plain lines and returns whether everything checked was fine. Server code only.

import { comfyModels, configuredImageToolUrl, imageToolSettings, imageToolTimeoutMs, makeToolPicture, otherKindAnswering, pingImageTool } from "./image-tool";
import { WorkerApiError, workerApi } from "./worker-client";
import { TOKEN_PATTERN, cleanAppUrl } from "./worker-protocol";
import { comfyModelLine, formatCheck, imageProgramLine, otherKindLine, pictureLine, settingsLines, websiteLine, type CheckLine } from "./studio-check-core";

export async function runStudioCheck(opts: { picture: boolean }, print: (text: string) => void = console.log): Promise<boolean> {
  const lines: CheckLine[] = settingsLines(process.env);
  const app = cleanAppUrl(process.env.APP_URL);
  const token = process.env.WORKER_TOKEN?.trim() ?? "";

  let mayMakePictures = true;
  if (app.ok && TOKEN_PATTERN.test(token)) {
    try {
      const got = await workerApi(app.url, token).check();
      lines.push(websiteLine({ ok: true, ...got }, app.url));
      mayMakePictures = got.pictures;
    } catch (err) {
      const e = err instanceof WorkerApiError ? err : new WorkerApiError(String(err), 0);
      lines.push(websiteLine({ ok: false, status: e.status, message: e.message }, app.url));
    }
  }

  const toolUrl = configuredImageToolUrl();
  if (toolUrl) {
    if (!mayMakePictures) {
      lines.push({ ok: true, name: "Image program answers", said: "Not tried: this token may not take pictures, so the image program is not used." });
    } else {
      const settings = imageToolSettings();
      const ping = await pingImageTool(toolUrl, undefined, settings);
      lines.push(imageProgramLine(ping.ok ? { ok: true } : { ok: false, error: ping.error }, toolUrl));
      if (!ping.ok) {
        // The most likely mistake with two kinds of program: the right address, the wrong kind.
        const other = await otherKindAnswering(toolUrl, settings);
        if (other) lines.push(otherKindLine(other, toolUrl));
      }
      const modelLine = ping.ok && settings.kind === "comfyui" && settings.model ? comfyModelLine(settings.model, await comfyModels(toolUrl)) : null;
      if (modelLine) lines.push(modelLine);
      if (ping.ok && opts.picture && settings.problems.length === 0 && modelLine?.ok !== false) {
        const started = Date.now();
        const made = await makeToolPicture(toolUrl, "a smooth grey stone on a wooden table, soft light", "stones", AbortSignal.timeout(imageToolTimeoutMs()));
        lines.push(pictureLine(made.ok ? { ok: true, seconds: Math.round((Date.now() - started) / 1000) } : { ok: false, error: made.error }));
      }
    }
  }

  const { text, allOk } = formatCheck(lines);
  print(text);
  return allOk;
}
