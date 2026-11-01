// The picture studio's choice of image program and picture size (open item P1): the settings, the ComfyUI workflow, and a ComfyUI stand-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { IMAGE_SIZE, SDXL_IMAGE_SIZE, imageSizeFor } from "../lib/art-maker";
import { COMFY_OUTPUT_NODE, comfyModelNames, comfyRefusal, comfyWorkflow, describeSettings, readComfyHistory, readImageToolSettings } from "../lib/image-tool-settings";
import { makeToolPicture, otherKindAnswering, pingImageTool, probeUpscaler, enlargeToolPicture } from "../lib/image-tool";
import { comfyModelLine, otherKindLine, settingsLines } from "../lib/studio-check-core";

test("with no image settings a studio does what it always did: KoboldCpp's API, standard sizes, 20 steps, guidance 7", () => {
  assert.deepEqual(readImageToolSettings({}), { kind: "sdapi", size: "standard", model: null, steps: 20, cfg: 7, problems: [] });
});

test("the kind of image program is read from IMAGE_GEN_KIND under the names people use for them", () => {
  for (const name of ["koboldcpp", "KoboldCpp", "a1111", "automatic1111", "forge", "sdnext", "SD.Next", " sdapi "]) {
    assert.equal(readImageToolSettings({ IMAGE_GEN_KIND: name }).kind, "sdapi", name);
  }
  const comfy = readImageToolSettings({ IMAGE_GEN_KIND: "ComfyUI", IMAGE_GEN_MODEL: "sdxl_base.safetensors" });
  assert.equal(comfy.kind, "comfyui");
  assert.equal(comfy.model, "sdxl_base.safetensors");
  assert.deepEqual(comfy.problems, []);
});

test("a mistyped or missing setting is named in plain words and falls back to its default", () => {
  const typo = readImageToolSettings({ IMAGE_GEN_KIND: "comfey", IMAGE_GEN_SIZE: "huge", IMAGE_GEN_STEPS: "200", IMAGE_GEN_CFG: "x" });
  assert.equal(typo.kind, "sdapi");
  assert.equal(typo.size, "standard");
  assert.equal(typo.steps, 20);
  assert.equal(typo.cfg, 7);
  assert.equal(typo.problems.length, 4);
  assert.match(typo.problems[0], /IMAGE_GEN_KIND=comfey/);
  assert.match(readImageToolSettings({ IMAGE_GEN_KIND: "comfyui" }).problems.join(" "), /needs IMAGE_GEN_MODEL/);
  assert.match(readImageToolSettings({ IMAGE_GEN_KIND: "comfyui", IMAGE_GEN_MODEL: "old.ckpt" }).problems.join(" "), /hidden code/);
});

test("steps and guidance can be lowered for a fast model, within limits", () => {
  const fast = readImageToolSettings({ IMAGE_GEN_STEPS: "6", IMAGE_GEN_CFG: "1.5" });
  assert.equal(fast.steps, 6);
  assert.equal(fast.cfg, 1.5);
  assert.deepEqual(fast.problems, []);
  assert.equal(readImageToolSettings({ IMAGE_GEN_STEPS: "2.5" }).problems.length, 1);
});

test("SDXL sizes are about a million pixels, multiples of 64, and keep each form's shape", () => {
  for (const [form, size] of Object.entries(SDXL_IMAGE_SIZE)) {
    assert.equal(size.width % 64, 0, form);
    assert.equal(size.height % 64, 0, form);
    const pixels = size.width * size.height;
    assert.ok(pixels >= 900_000 && pixels <= 1_100_000, `${form}: ${pixels}`);
    const standard = IMAGE_SIZE[form as keyof typeof IMAGE_SIZE];
    assert.ok(Math.abs(size.width / size.height - standard.width / standard.height) < 0.03, form);
  }
  assert.deepEqual(imageSizeFor("cards"), IMAGE_SIZE.cards);
  assert.deepEqual(imageSizeFor("cards", "sdxl"), SDXL_IMAGE_SIZE.cards);
  assert.deepEqual(imageSizeFor("nonsense", "sdxl"), SDXL_IMAGE_SIZE.cards);
  assert.equal(readImageToolSettings({ IMAGE_GEN_SIZE: "SDXL" }).size, "sdxl");
});

test("the ComfyUI workflow carries only the prompt, the size and the studio's own settings, and keeps the picture out of ComfyUI's output folder", () => {
  const w = comfyWorkflow({ prompt: "a lantern", width: 832, height: 1152, model: "m.safetensors", steps: 20, cfg: 7, seed: 5 });
  assert.equal(w["6"].inputs.text, "a lantern");
  assert.deepEqual([w["5"].inputs.width, w["5"].inputs.height], [832, 1152]);
  assert.equal(w["4"].inputs.ckpt_name, "m.safetensors");
  assert.equal(w[COMFY_OUTPUT_NODE].class_type, "PreviewImage");
  assert.ok(!JSON.stringify(w).includes("SaveImage"));
});

test("ComfyUI's history is read as waiting, done or failed", () => {
  assert.deepEqual(readComfyHistory({}, "p1"), { state: "waiting" });
  assert.deepEqual(readComfyHistory(null, "p1"), { state: "waiting" });
  assert.deepEqual(readComfyHistory({ p1: { outputs: { [COMFY_OUTPUT_NODE]: { images: [{ filename: "a.png", subfolder: "", type: "temp" }] } }, status: { completed: true } } }, "p1"), {
    state: "done",
    image: { filename: "a.png", subfolder: "", type: "temp" },
  });
  const failed = readComfyHistory({ p1: { outputs: {}, status: { status_str: "error", messages: [["execution_error", { exception_message: "out of memory" }]] } } }, "p1");
  assert.equal(failed.state, "failed");
  if (failed.state === "failed") assert.match(failed.error, /out of memory/);
  assert.equal(readComfyHistory({ p1: { outputs: {}, status: { completed: true } } }, "p1").state, "failed");
  assert.match(comfyRefusal({ node_errors: { "4": { errors: [{ details: "ckpt_name: 'x' not in list" }] } } }, "x.safetensors"), /no model called x\.safetensors/);
  assert.deepEqual(comfyModelNames({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [["a.safetensors", "b.safetensors"]] } } } }), ["a.safetensors", "b.safetensors"]);
  assert.equal(comfyModelNames({}), null);
});

test("the studio's test names the picture settings, a wrong kind of program, and a missing ComfyUI model", () => {
  const ok = settingsLines({ IMAGE_GEN_URL: "http://localhost:8188", IMAGE_GEN_KIND: "comfyui", IMAGE_GEN_MODEL: "m.safetensors", IMAGE_GEN_SIZE: "sdxl" });
  const line = ok.find((l) => l.name === "Picture settings")!;
  assert.equal(line.ok, true);
  assert.match(line.said, /ComfyUI with m\.safetensors, SDXL sizes/);
  assert.match(line.fix ?? "", /slower/);
  const bad = settingsLines({ IMAGE_GEN_URL: "http://localhost:5001", IMAGE_GEN_KIND: "nope" }).find((l) => l.name === "Picture settings")!;
  assert.equal(bad.ok, false);
  assert.ok(!settingsLines({ COMPANION_URL: "http://localhost:5002" }).some((l) => l.name === "Picture settings"));
  assert.match(otherKindLine("comfyui", "http://localhost:8188").fix!, /IMAGE_GEN_KIND=comfyui/);
  assert.equal(comfyModelLine("m.safetensors", ["m.safetensors"])!.ok, true);
  assert.match(comfyModelLine("m.safetensors", ["a.safetensors"])!.said, /It has: a\.safetensors/);
  assert.equal(comfyModelLine("m.safetensors", null), null);
  assert.match(describeSettings(readImageToolSettings({})), /KoboldCpp's API/);
});

// --- a small ComfyUI stand-in ---
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const COMFY = readImageToolSettings({ IMAGE_GEN_KIND: "comfyui", IMAGE_GEN_MODEL: "m.safetensors", IMAGE_GEN_SIZE: "sdxl" });

interface FakeComfy {
  queued: any[];
  deleted: string[];
  interrupted: number;
  /** How many looks at the history before the picture is ready (Infinity = never). */
  looksUntilDone: number;
  refuse?: boolean;
}

async function withComfy<T>(fake: FakeComfy, run: (url: string) => Promise<T>): Promise<T> {
  let looks = 0;
  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://x");
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
      if (url.pathname === "/system_stats") return send(200, { system: {} });
      if (url.pathname === "/prompt" && req.method === "POST") {
        if (fake.refuse) return send(400, { error: { message: "Prompt outputs failed validation" }, node_errors: { "4": { errors: [{ details: "ckpt_name: not in list" }] } } });
        fake.queued.push(body);
        return send(200, { prompt_id: "p1", number: 1 });
      }
      if (url.pathname === "/history/p1") {
        looks++;
        if (looks < fake.looksUntilDone) return send(200, {});
        return send(200, { p1: { outputs: { [COMFY_OUTPUT_NODE]: { images: [{ filename: "ds_1.png", subfolder: "", type: "temp" }] } }, status: { completed: true } } });
      }
      if (url.pathname === "/view") {
        assert.equal(url.searchParams.get("filename"), "ds_1.png");
        assert.equal(url.searchParams.get("type"), "temp");
        res.writeHead(200, { "Content-Type": "image/png" });
        return res.end(PNG);
      }
      if (url.pathname === "/queue" && req.method === "GET") return send(200, { queue_running: [], queue_pending: [[1, "p1", {}, {}, []]] });
      if (url.pathname === "/queue" && req.method === "POST") {
        fake.deleted.push(...(body?.delete ?? []));
        return send(200, {});
      }
      if (url.pathname === "/interrupt") {
        fake.interrupted++;
        return send(200, {});
      }
      send(404, {});
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("a picture is made with ComfyUI: queued at SDXL size, waited for, fetched and checked", async () => {
  const fake: FakeComfy = { queued: [], deleted: [], interrupted: 0, looksUntilDone: 2 };
  await withComfy(fake, async (url) => {
    assert.equal((await pingImageTool(url, undefined, COMFY)).ok, true);
    const result = await makeToolPicture(url, "a lantern", "cards", AbortSignal.timeout(10_000), COMFY);
    assert.deepEqual(result, { ok: true, value: `data:image/png;base64,${PNG.toString("base64")}` });
    const w = fake.queued[0].prompt;
    assert.deepEqual([w["5"].inputs.width, w["5"].inputs.height], [SDXL_IMAGE_SIZE.cards.width, SDXL_IMAGE_SIZE.cards.height]);
    assert.equal(w["6"].inputs.text, "a lantern");
    // ComfyUI cannot enlarge pictures through this app, and the check says so without asking it.
    assert.equal(await probeUpscaler(url, undefined, COMFY), false);
    assert.equal((await enlargeToolPicture(url, "data:image/png;base64,AAAA", 2, AbortSignal.timeout(1000), COMFY)).ok, false);
    // A studio set to KoboldCpp's API at a ComfyUI address is told which kind answers there.
    assert.equal(await otherKindAnswering(url, readImageToolSettings({})), "comfyui");
  });
});

test("a ComfyUI picture that is stopped is taken out of its queue, and a refused model is named", async () => {
  const fake: FakeComfy = { queued: [], deleted: [], interrupted: 0, looksUntilDone: Infinity };
  await withComfy(fake, async (url) => {
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 1500);
    const result = await makeToolPicture(url, "a lantern", "stones", stop.signal, COMFY);
    assert.deepEqual(result, { ok: false, status: 499, error: "Stopped." });
    assert.deepEqual(fake.deleted, ["p1"]);
    assert.equal(fake.interrupted, 0, "a picture that was only waiting is not interrupted");
  });
  await withComfy({ queued: [], deleted: [], interrupted: 0, looksUntilDone: 1, refuse: true }, async (url) => {
    const result = await makeToolPicture(url, "a lantern", "stones", AbortSignal.timeout(5000), COMFY);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /no model called m\.safetensors/);
  });
});

test("KoboldCpp's API is sent the SDXL size and the studio's steps and guidance when they are set", async () => {
  let sent: any = null;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      sent = JSON.parse(Buffer.concat(chunks).toString());
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ images: [PNG.toString("base64")] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const s = readImageToolSettings({ IMAGE_GEN_SIZE: "sdxl", IMAGE_GEN_STEPS: "6", IMAGE_GEN_CFG: "2" });
    const result = await makeToolPicture(url, "a lantern", "stones", AbortSignal.timeout(5000), s);
    assert.equal(result.ok, true);
    assert.deepEqual([sent.width, sent.height, sent.steps, sent.cfg_scale], [1024, 1024, 6, 2]);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
