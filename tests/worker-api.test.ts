import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { MAX_ANSWER_CHARS, MAX_COMPANION_CALLS, TOKEN_PATTERN, bearerToken, cleanAnswers, cleanAppUrl, cleanFailStatus, cleanPollSeconds, wordsForPerson } from "../lib/worker-protocol";
import { cleanTokenInput, hashWorkerToken, makeWorkerToken, requireWorker } from "../lib/worker-tokens";
import { workerApi } from "../lib/worker-client";
import { NeedsModelCall, replayingModel } from "../lib/companion-queue";
import { runCompanion, type AskModel, type ChatMessage } from "../lib/companion-run";
import { bodyTooBig } from "../lib/limits";

// The worker API lets a picture computer take jobs and send back results with a token of its own, instead of the database password
// (docs/security-audit.md, plan item 2). These tests pin the token's shape and check, the API's routes, and the companion's step-by-step path.

test("a worker token is dsw_ and 32 random bytes; only its SHA-256 is stored", () => {
  const a = makeWorkerToken();
  const b = makeWorkerToken();
  assert.match(a, TOKEN_PATTERN);
  assert.equal(a.length, 47);
  assert.notEqual(a, b);
  assert.match(hashWorkerToken(a), /^[0-9a-f]{64}$/);
  assert.equal(hashWorkerToken(a), hashWorkerToken(a));
  assert.notEqual(hashWorkerToken(a), hashWorkerToken(b));
  assert.ok(!hashWorkerToken(a).includes(a.slice(4)));
});

test("the token is read only from a Bearer header shaped like a token", () => {
  const t = makeWorkerToken();
  assert.equal(bearerToken(`Bearer ${t}`), t);
  assert.equal(bearerToken(`bearer ${t}`), t);
  assert.equal(bearerToken(`Bearer  ${t}  `), t);
  for (const bad of [null, undefined, "", t, `Basic ${t}`, `Bearer ${t.slice(0, -1)}`, `Bearer ${t}x`, `Bearer ${t.replace("dsw_", "dsx_")}`, `Bearer ${t} ${t}`, "Bearer dsw_' OR 1=1 --"]) {
    assert.equal(bearerToken(bad), null, String(bad));
  }
});

test("a request without a usable token is refused before the database is asked", async () => {
  // findWorker returns null for a malformed header without a query, so these run with no database at all.
  for (const header of [null, "Bearer nope", "Bearer dsw_short"]) {
    const headers = new Headers(header ? { authorization: header } : {});
    const res = await requireWorker({ headers }, "pictures");
    assert.ok(res instanceof Response);
    assert.equal(res.status, 401);
  }
});

test("a token's name and choices are checked; companion requests are off unless ticked", () => {
  assert.deepEqual(cleanTokenInput({ name: "  My PC " }), { ok: true, name: "My PC", pictures: true, companion: false });
  assert.deepEqual(cleanTokenInput({ name: "Mine", companion: true }), { ok: true, name: "Mine", pictures: true, companion: true });
  assert.deepEqual(cleanTokenInput({ name: "Text only", pictures: false, companion: true }), { ok: true, name: "Text only", pictures: false, companion: true });
  // Only a real true ticks companion requests: they carry people's own writing.
  const notTicked = cleanTokenInput({ name: "Mine", companion: "yes" });
  assert.ok(notTicked.ok && !notTicked.companion);
  assert.equal(cleanTokenInput({}).ok, false);
  assert.equal(cleanTokenInput({ name: "x".repeat(61) }).ok, false);
  assert.equal(cleanTokenInput({ name: "Nothing", pictures: false }).ok, false);
});

test("the website picks the words a person sees for a failed picture; the studio only sends a number", () => {
  assert.equal(cleanFailStatus(504), 504);
  assert.equal(cleanFailStatus("499"), 499);
  for (const bad of [undefined, "a", 200, 600, 3.5, "<b>hi</b>"]) assert.equal(cleanFailStatus(bad), 502);
  assert.match(wordsForPerson(504), /took too long/);
  assert.match(wordsForPerson(499), /stopped/);
  assert.match(wordsForPerson(502), /could not make that picture/);
});

test("the studio's numbers and answers are checked", () => {
  assert.equal(cleanPollSeconds(1800), 1800);
  assert.equal(cleanPollSeconds(5), 600);
  assert.equal(cleanPollSeconds("x"), 600);
  assert.deepEqual(cleanAnswers([]), []);
  assert.deepEqual(cleanAnswers(["NO", "1. Why?"]), ["NO", "1. Why?"]);
  assert.equal(cleanAnswers("NO"), null);
  assert.equal(cleanAnswers([1]), null);
  assert.equal(cleanAnswers(Array(MAX_COMPANION_CALLS + 1).fill("a")), null);
  assert.equal(cleanAnswers(["x".repeat(MAX_ANSWER_CHARS + 1)]), null);
});

test("APP_URL must be https, except for this computer itself", () => {
  assert.deepEqual(cleanAppUrl("https://divination.example.org/"), { ok: true, url: "https://divination.example.org" });
  assert.deepEqual(cleanAppUrl("http://localhost:3000"), { ok: true, url: "http://localhost:3000" });
  assert.deepEqual(cleanAppUrl("http://127.0.0.1:3101"), { ok: true, url: "http://127.0.0.1:3101" });
  for (const bad of [undefined, "", "divination.example", "http://192.168.1.5:3000", "http://example.com", "ftp://example.com", "https://user:pw@example.com", "https://example.com/?x=1"]) {
    assert.equal(cleanAppUrl(bad).ok, false, String(bad));
  }
});

// --- The routes ---

const WORKER_API = path.join(process.cwd(), "app", "api", "worker");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : []
  );
}

test("the worker API has exactly these routes, all POST, each checking the token (and the kind) first", () => {
  const routes = Object.fromEntries(
    routeFiles(WORKER_API).map((f) => [path.relative(WORKER_API, path.dirname(f)).split(path.sep).join("/"), readFileSync(f, "utf8")])
  );
  assert.deepEqual(Object.keys(routes).sort(), [
    "check",
    "companion/[id]/step",
    "companion/claim",
    "heartbeat",
    "hello",
    "pictures/[id]/done",
    "pictures/[id]/failed",
    "pictures/claim",
  ]);
  for (const [route, source] of Object.entries(routes)) {
    assert.deepEqual(source.match(/export async function (\w+)/g), ["export async function POST"], route);
    const kind = route.startsWith("pictures/") ? "pictures" : route.startsWith("companion/") ? "companion" : null;
    const check = kind ? `await requireWorker(request, "${kind}");` : "await requireWorker(request);";
    assert.ok(source.includes(check), `${route} checks ${check}`);
    // The token is the only way in: nothing here reads the browser session or another account.
    assert.doesNotMatch(source, /getSession|session\.userId|x-claude/, route);
    // A worker can only touch the jobs it claimed: finishing, failing and stepping pass its id.
    if (/\[id\]/.test(route)) assert.match(source, /worker\.id\)/, route);
  }
});

test("the proxy lets the studio's routes through to their own token check, and a picture fits", () => {
  const proxy = readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");
  assert.match(proxy, /pathname\.startsWith\("\/api\/worker\/"\)/);
  assert.equal(bodyTooBig("/api/worker/pictures/12/done", "1400000"), false);
  assert.equal(bodyTooBig("/api/worker/pictures/claim", "1400000"), true);
  assert.equal(bodyTooBig("/api/worker/companion/3/step", "1400000"), true);
});

test("the studio never imports database code and never reads DATABASE_URL", () => {
  for (const file of ["scripts/image-worker.ts", "lib/worker-client.ts", "lib/worker-protocol.ts"]) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /from ["'](\.\.?\/)+(lib\/)?(db|image-queue|companion-queue)["']|import\(["'](\.\.?\/)+(lib\/)?(db|image-queue|companion-queue)["']\)/, file);
  }
  const worker = readFileSync(path.join(process.cwd(), "scripts/image-worker.ts"), "utf8");
  const wanted = worker.match(/const WANTED = \[([^\]]*)\]/)![1];
  assert.doesNotMatch(wanted, /DATABASE_URL/);
  assert.match(wanted, /"APP_URL"/);
  assert.match(wanted, /"WORKER_TOKEN"/);
});

test("the studio's client calls the routes that exist, with its token, and sends a picture as raw bytes", async () => {
  const token = makeWorkerToken();
  const seen: { url: string; init: RequestInit }[] = [];
  const replies: Record<string, unknown> = {
    hello: { name: "My PC", pictures: true, companion: true, requeued: { pictures: 0, companion: 0 } },
    heartbeat: { ok: true },
    "pictures/claim": { job: { id: 7, user_id: 2, prompt: "a fox", form: "cards" } },
    "pictures/7/done": { kept: true },
    "pictures/7/failed": { marked: true },
    "companion/claim": { job: { id: 3, user_id: 2, mode: "questions" }, ask: { messages: [], maxTokens: 5, temperature: 0 } },
    "companion/3/step": { result: "done" },
  };
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    const p = url.replace("https://app.example/api/worker/", "");
    return new Response(JSON.stringify(replies[p] ?? { error: "no" }), { status: replies[p] ? 200 : 404 });
  }) as unknown as typeof fetch;
  const api = workerApi("https://app.example", token, fakeFetch);
  assert.equal((await api.hello(1800)).name, "My PC");
  await api.heartbeat(1800);
  assert.equal((await api.claimPicture())?.prompt, "a fox");
  assert.equal(await api.sendPicture(7, Buffer.from([1, 2, 3]), "image/webp"), true);
  await api.failPicture(7, 504);
  assert.equal((await api.claimCompanion("m"))?.job.id, 3);
  assert.deepEqual(await api.stepCompanion(3, ["NO"], "m"), { result: "done" });

  for (const { url, init } of seen) {
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${token}`);
    const route = url.replace("https://app.example/api/worker/", "").replace(/\/\d+\//, "/[id]/");
    assert.ok(existsSync(path.join(WORKER_API, ...route.split("/"), "route.ts")), `${route} is a real route`);
  }
  const picture = seen.find((s) => s.url.endsWith("/done"))!;
  assert.equal((picture.init.headers as Record<string, string>)["Content-Type"], "image/webp");
  assert.deepEqual([...(picture.init.body as Uint8Array)], [1, 2, 3]);
  assert.deepEqual(JSON.parse(seen.find((s) => s.url.endsWith("/failed"))!.init.body as string), { status: 504 });
});

test("the client turns a refusal into an error that carries the status, so the studio can stop on a revoked token", async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(workerApi("https://app.example", makeWorkerToken(), fakeFetch).claimPicture(), (err: { status?: number }) => err.status === 401);
  const down = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  await assert.rejects(workerApi("https://app.example", makeWorkerToken(), down).claimPicture(), (err: { status?: number; message: string }) => err.status === 0 && /could not reach/.test(err.message));
});

// --- The companion, one model call at a time ---

const ORDINARY = "Your stone reading of 2026-10-11.\n\nThe stone that came up: Sunflower\nYou wrote on 2026-10-11: Got the job!! I can't stop smiling.";
const EXPLICIT = "Your card reading of 2026-10-07.\nYou wrote on 2026-10-07: I want to die.";

/** Runs the companion the way the website does for a studio: again from the start with the answers so far, until it stops asking. */
async function stepByStep(context: string, model: (messages: ChatMessage[]) => string) {
  const answers: string[] = [];
  const calls: ChatMessage[][] = [];
  for (let step = 0; step <= MAX_COMPANION_CALLS; step++) {
    try {
      const outcome = await runCompanion({ context, name: "Ember", acknowledged: false, ask: replayingModel(answers) });
      return { outcome, calls };
    } catch (err) {
      if (!(err instanceof NeedsModelCall)) throw err;
      calls.push(err.call.messages);
      answers.push(model(err.call.messages)); // the studio runs this call and sends back every answer so far
    }
  }
  throw new Error("too many steps");
}

test("step by step through the studio gives the same result as asking the model directly", async () => {
  const model = (m: ChatMessage[]) => (/checking a private journal/i.test(m[0].content) ? "NO" : "Warm.\n\n1. What did you notice first?\n2. What is missing?");
  const direct: ChatMessage[][] = [];
  const ask: AskModel = async (messages) => {
    direct.push(messages);
    return model(messages);
  };
  const expected = await runCompanion({ context: ORDINARY, name: "Ember", acknowledged: false, ask });
  const viaStudio = await stepByStep(ORDINARY, model);
  assert.deepEqual(viaStudio.outcome, expected);
  assert.deepEqual(viaStudio.calls, direct);
  assert.equal(viaStudio.calls.length, 2); // the risk check, then the questions
});

test("through the studio, the website's safety checks still decide: a crisis never reaches the model, a YES stops it", async () => {
  const crisis = await stepByStep(EXPLICIT, () => "anything");
  assert.equal(crisis.outcome.action, "crisis");
  assert.equal(crisis.calls.length, 0);
  const yes = await stepByStep(ORDINARY, (m) => (/checking a private journal/i.test(m[0].content) ? "YES" : "1. Q?\n2. Q?"));
  assert.equal(yes.outcome.action, "crisis");
  assert.equal(yes.calls.length, 1);
});

test("a studio's answers are used in order, and the first missing one is asked for", async () => {
  const ask = replayingModel(["first"]);
  assert.equal(await ask([{ role: "user", content: "a" }], { maxTokens: 1, temperature: 0 }), "first");
  await assert.rejects(ask([{ role: "user", content: "b" }], { maxTokens: 9, temperature: 0.5 }), (err: unknown) => {
    assert.ok(err instanceof NeedsModelCall);
    assert.deepEqual(err.call, { messages: [{ role: "user", content: "b" }], maxTokens: 9, temperature: 0.5 });
    return true;
  });
});
