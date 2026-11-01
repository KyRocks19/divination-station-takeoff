/**
 * The picture studio: runs on a picture computer (the owner's, for now), takes pictures waiting in the queue, makes each with the image tool
 * (IMAGE_GEN_URL, for example KoboldCpp), and sends the finished picture back for the person to collect. It talks to the website's worker API
 * (app/api/worker/**) with a token of its own, made on the website at /admin/workers. It never holds the database password.
 *
 *   npx tsx scripts/image-worker.ts [--once] [--idle-seconds 1800] [--env .env.local]
 *   npx tsx scripts/image-worker.ts --check [--picture]   the test: settings, website, image program (and one test picture); changes nothing
 *
 * It opens no port. It makes connections out, never in: to the website, to the image tool, and (when set) to Redis.
 * Settings (environment, or the same names in --env, default .env.local):
 *   APP_URL                   the website's address, for example https://divination.example.org (https, or http only for this computer)
 *   WORKER_TOKEN              this computer's token from /admin/workers (starts dsw_). It can only take jobs and send back results.
 *   IMAGE_GEN_URL             the image tool's address
 *   IMAGE_GEN_TIMEOUT_SECONDS how long to wait for one picture (default 900; an SDXL model wants more)
 *   IMAGE_GEN_KIND            which image program is at IMAGE_GEN_URL: koboldcpp (the default; also right for AUTOMATIC1111, Forge and
 *                             SD.Next, which answer the same API) or comfyui
 *   IMAGE_GEN_MODEL           ComfyUI only: the model file in its models/checkpoints folder, for example dreamshaper_8.safetensors
 *   IMAGE_GEN_SIZE            sdxl asks for pictures at an SDXL model's own size (about 1024 by 1024: better pictures, slower). Off unless set
 *   IMAGE_GEN_STEPS, IMAGE_GEN_CFG  steps (default 20) and guidance (default 7); a fast "Lightning" or "Turbo" model wants about 6 and 2
 *   COMPANION_URL             the address of KoboldCpp in router mode that answers the AI companion (for example http://localhost:5002).
 *                             When set, and the token allows companion requests, the studio also answers those (docs/companion.md): the
 *                             website runs every check and hands the studio one model call at a time. Either this or IMAGE_GEN_URL is needed.
 *   COMPANION_PASSWORD        the admin password KoboldCpp was started with, if any
 *   COMPANION_MODEL           the config file in its admin folder to answer with (default Gemma4-v2-Q4plain.kcpps)
 *   UPSTASH_REDIS_URL         the Redis doorbell, a rediss://default:<password>@<host>:6379 string. When the website has a picture
 *                             for this studio it leaves a note in Redis; the studio waits for notes there (one connection out),
 *                             so pictures start within seconds, and the queue is only looked at when a note comes, after a
 *                             batch, and as a safety look every WORKER_IDLE_POLL_SECONDS. The studio also keeps a flag
 *                             "ds:alive" in Redis so the website can say awake or asleep without asking the database.
 *   WORKER_IDLE_POLL_SECONDS  the safety look at the queue when nothing is waiting (default 1800 with Redis, 600 without). Every
 *                             look wakes the free database for at least five minutes, so a short time here uses up the plan's
 *                             monthly allowance of awake time.
 * Press Ctrl+C to stop; the website then shows the studio as asleep at once.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Redis from "ioredis";
import sharp from "sharp";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : undefined;
}

// Reads only the settings this program uses from the env file; anything already in the environment wins. DATABASE_URL is not among them.
const WANTED = ["APP_URL", "WORKER_TOKEN", "IMAGE_GEN_URL", "IMAGE_GEN_TIMEOUT_SECONDS", "IMAGE_GEN_KIND", "IMAGE_GEN_MODEL", "IMAGE_GEN_SIZE", "IMAGE_GEN_STEPS", "IMAGE_GEN_CFG", "WORKER_IDLE_POLL_SECONDS", "UPSTASH_REDIS_URL", "COMPANION_URL", "COMPANION_PASSWORD", "COMPANION_MODEL"];
const envFile = resolve(arg("env") ?? ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && WANTED.includes(m[1]) && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const log = (text: string) => console.log(`${new Date().toLocaleTimeString()} [image-worker] ${text}`);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function toWebp(dataUrl: string, maxBytes: number): Promise<{ bytes: Buffer; mime: string } | null> {
  const input = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  for (const quality of [88, 75, 60]) {
    const bytes = await sharp(input).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (bytes.length <= maxBytes) return { bytes, mime: "image/webp" };
  }
  return null;
}

async function main() {
  // `--check` is the test screen: it looks at the settings, the website and the image program, prints plain lines and stops (lib/studio-check.ts).
  if (process.argv.includes("--check")) {
    const { runStudioCheck } = await import("../lib/studio-check");
    process.exit((await runStudioCheck({ picture: process.argv.includes("--picture") })) ? 0 : 1);
  }
  const { configuredImageToolUrl, imageToolSettings, imageToolTimeoutMs, makeToolPicture, pingImageTool } = await import("../lib/image-tool");
  const { describeSettings } = await import("../lib/image-tool-settings");
  const { ALIVE_KEY, ALIVE_SECONDS, WAKE_LIST } = await import("../lib/studio-signal");
  const { companionEndpoint, makeAsk } = await import("../lib/companion-model");
  const { MAX_COMPANION_CALLS, MAX_RESULT_BYTES, TOKEN_PATTERN, cleanAppUrl } = await import("../lib/worker-protocol");
  const { WorkerApiError, workerApi } = await import("../lib/worker-client");

  const app = cleanAppUrl(process.env.APP_URL);
  if (!app.ok) throw new Error(app.error);
  const token = process.env.WORKER_TOKEN?.trim() ?? "";
  if (!TOKEN_PATTERN.test(token)) throw new Error("No WORKER_TOKEN, or it is not a whole token (it starts dsw_ and is 47 characters). Make one on the website at /admin/workers.");
  let toolUrl = configuredImageToolUrl();
  let companion = companionEndpoint();
  if (!toolUrl && !companion) throw new Error("Nothing to do: set IMAGE_GEN_URL (the image tool, for example http://localhost:5001) and/or COMPANION_URL (the companion's model, for example http://localhost:5002).");
  const pictureSettings = imageToolSettings();
  // A mistyped image setting would fail every picture (or ask the wrong program), so the studio does not start with one.
  if (toolUrl && pictureSettings.problems.length) throw new Error(pictureSettings.problems.join(" ") + " Fix .env.local and run the test (--check) again.");
  if (process.env.DATABASE_URL) log("DATABASE_URL is set in this window but not used: the studio talks to the website instead");

  const once = process.argv.includes("--once");
  const redisUrl = process.env.UPSTASH_REDIS_URL?.trim() || "";
  if (redisUrl && !/^rediss?:\/\//i.test(redisUrl)) throw new Error("UPSTASH_REDIS_URL must start with rediss:// (two s).");
  const idleSeconds = Math.max(30, Number(arg("idle-seconds") ?? process.env.WORKER_IDLE_POLL_SECONDS) || (redisUrl ? 1800 : 600));

  const api = workerApi(app.url, token);
  // Hello: the website puts back what this studio left unfinished last time, and says what this token may take.
  const hello = await api.hello(idleSeconds).catch((err) => {
    if (err instanceof WorkerApiError && err.status === 401) throw new Error(`The website did not accept WORKER_TOKEN (${app.url}): it is mistyped or was revoked. Make a new one at /admin/workers.`);
    throw err;
  });
  if (toolUrl && !hello.pictures) {
    log("this token may not take pictures; IMAGE_GEN_URL is ignored");
    toolUrl = null;
  }
  if (companion && !hello.companion) {
    log("this token may not take companion requests; COMPANION_URL is ignored");
    companion = null;
  }
  if (!toolUrl && !companion) throw new Error("Nothing this token may do with the tools set here. Check the token's choices at /admin/workers.");
  log(`website: ${app.url} (as "${hello.name}"${hello.circle ? ", a circle's picture computer: it makes only that circle's pictures" : ""}); image tool: ${toolUrl ? `${toolUrl} (${describeSettings(pictureSettings)})` : "none"}; companion: ${companion ? `${companion.url} (${companion.model})` : "none"}`);
  if (hello.requeued.pictures) log(`${hello.requeued.pictures} picture(s) left over from an earlier run went back in the queue`);
  if (hello.requeued.companion) log(`${hello.requeued.companion} companion request(s) left over from an earlier run went back in the queue`);

  let stopping = false;

  // The doorbell: one connection waits for notes, a second one keeps the "I am running" flag fresh (a picture can take minutes
  // and the waiting connection is busy or the studio is drawing, so the flag must not depend on either).
  const redisOptions = { maxRetriesPerRequest: null, connectTimeout: 10_000, retryStrategy: (n: number) => Math.min(30_000, 1000 * 2 ** Math.min(n, 5)) };
  const listener = redisUrl ? new Redis(redisUrl, redisOptions) : null;
  const beacon = redisUrl ? new Redis(redisUrl, redisOptions) : null;
  let redisWasDown = false;
  for (const r of [listener, beacon]) {
    r?.on("error", (err) => {
      if (!redisWasDown) log(`Redis is not answering (${err.message}); using the safety look every ${idleSeconds}s until it does`);
      redisWasDown = true;
    });
    r?.on("ready", () => {
      if (redisWasDown) log("Redis is back");
      redisWasDown = false;
    });
  }
  let beaconTimer: NodeJS.Timeout | null = null;
  if (beacon) {
    const keepAlive = () => void beacon.set(ALIVE_KEY, "1", "EX", ALIVE_SECONDS).catch(() => {});
    keepAlive();
    beaconTimer = setInterval(keepAlive, 30_000);
    log("Redis doorbell on: waiting for notes from the website");
  } else {
    log(`no UPSTASH_REDIS_URL: looking at the queue every ${idleSeconds}s`);
  }

  const stop = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    log("stopping");
    if (beaconTimer) clearInterval(beaconTimer);
    await Promise.race([beacon?.del(ALIVE_KEY).catch(() => {}), sleep(2000)]);
    await api.heartbeat(idleSeconds, true).catch(() => {});
    process.exit(code);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());

  // Notes left from before this run are old news: the first look at the queue below sees everything that is waiting.
  await listener?.del(WAKE_LIST).catch(() => {});

  // Companion requests are quick (a few seconds each), so they are answered first, and again between pictures. The website runs every check
  // and hands this studio one model call at a time; the studio sends back every answer so far until the website says the request is finished.
  async function drainCompanion() {
    if (!companion) return;
    const ask = makeAsk(companion);
    for (;;) {
      const claimed = await api.claimCompanion(companion.model);
      if (!claimed) return;
      const { job } = claimed;
      const started = Date.now();
      let step: Awaited<ReturnType<typeof api.stepCompanion>> = claimed;
      const answers: string[] = [];
      while ("ask" in step && answers.length < MAX_COMPANION_CALLS) {
        let answer: string;
        try {
          answer = await ask(step.ask.messages, { maxTokens: step.ask.maxTokens, temperature: step.ask.temperature });
        } catch (err) {
          log(`companion job ${job.id}: the model did not answer (${err instanceof Error ? err.message : err})`);
          step = await api.stepCompanion(job.id, "failed", companion.model);
          break;
        }
        answers.push(answer);
        step = await api.stepCompanion(job.id, answers, companion.model);
      }
      const result = "result" in step ? step.result : "failed (too many model calls)";
      log(`companion job ${job.id} (user ${job.user_id}, ${job.mode}) ${result} after ${Math.round((Date.now() - started) / 1000)}s and ${answers.length} model call(s)`);
    }
  }

  async function drain() {
    await drainCompanion();
    if (toolUrl) await drainPictures();
    else await api.heartbeat(idleSeconds);
  }

  async function drainPictures() {
    const ping = await pingImageTool(toolUrl!);
    if (!ping.ok) {
      log(`the image tool is not answering (${ping.error}); leaving the queue alone`);
      return;
    }
    await api.heartbeat(idleSeconds);
    let failuresInARow = 0;
    for (;;) {
      await drainCompanion();
      const job = await api.claimPicture();
      if (!job) return;
      const started = Date.now();
      const result = await makeToolPicture(toolUrl!, job.prompt, job.form, AbortSignal.timeout(imageToolTimeoutMs()));
      const seconds = Math.round((Date.now() - started) / 1000);
      if (!result.ok) {
        log(`job ${job.id} (user ${job.user_id}) FAILED after ${seconds}s: ${result.status} ${result.error}`);
        await api.failPicture(job.id, result.status);
        // A tool that fails again and again would fail everybody's pictures one by one: stop and look again later.
        if (++failuresInARow >= 3) {
          log("three failures in a row; pausing until the next look");
          return;
        }
        continue;
      }
      failuresInARow = 0;
      const webp = await toWebp(result.value, MAX_RESULT_BYTES);
      if (!webp) {
        await api.failPicture(job.id, 502);
        log(`job ${job.id} FAILED: the picture could not be made small enough to keep`);
        continue;
      }
      const kept = await api.sendPicture(job.id, webp.bytes, webp.mime);
      log(`job ${job.id} (user ${job.user_id}) ${kept ? "done" : "was cancelled meanwhile; picture thrown away"} after ${seconds}s (${Math.round(webp.bytes.length / 1000)} KB)`);
      await api.heartbeat(idleSeconds);
    }
  }

  let lastLook = 0;
  let lastWake = 0;
  for (;;) {
    try {
      lastLook = Date.now();
      await drain();
    } catch (err) {
      if (err instanceof WorkerApiError && err.status === 401) {
        log("the website no longer accepts this studio's token (it was revoked); stopping");
        await stop(1);
      }
      log(`error: ${err instanceof Error ? err.message : err}`);
    }
    if (once || stopping) break;
    if (!listener) {
      log(`nothing more to do; looking again in ${idleSeconds}s`);
      await sleep(idleSeconds * 1000);
      continue;
    }
    // Wait for a note (up to 30 s at a time) until one comes or it is time for the safety look.
    log(`nothing more to do; waiting for a note (safety look in ${Math.round(idleSeconds / 60)} min)`);
    while (!stopping) {
      if (Date.now() - lastLook >= idleSeconds * 1000) {
        log("safety look");
        break;
      }
      let note: [string, string] | null = null;
      try {
        note = await listener.brpop(WAKE_LIST, 30);
      } catch {
        await sleep(5000); // Redis is down: the reconnect logic is working on it; the safety look still comes
        continue;
      }
      if (!note) continue;
      // Take the rest of the notes now: notes that arrive while pictures are being made ring again afterwards.
      await listener.del(WAKE_LIST).catch(() => {});
      const wait = 5000 - (Date.now() - lastWake);
      if (wait > 0) await sleep(wait); // at most one look every 5 s, however many notes come
      lastWake = Date.now();
      log("a picture is waiting");
      break;
    }
  }
  if (beaconTimer) clearInterval(beaconTimer);
  await Promise.race([beacon?.del(ALIVE_KEY).catch(() => {}), sleep(2000)]);
  listener?.disconnect();
  beacon?.disconnect();
}

// Only run when started directly: from the project (image-worker.ts) or from the downloadable package (studio.mjs, scripts/build-studio-package.ts).
if (process.argv[1] && /(image-worker\.ts|studio\.mjs)$/.test(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((err) => {
    console.error("image-worker FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
