import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { MAX_ENLARGE_INPUT_BYTES, MAX_TOOL_IMAGE_BYTES, checkToolImage, configuredImageToolUrl, enlargeToolPicture, fitEnlarged } from "../lib/image-tool";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test("a picture from the image tool must decode to a real JPEG, PNG, or WebP", () => {
  const png = Buffer.from([...PNG_HEAD, 1, 2, 3]).toString("base64");
  assert.equal(checkToolImage(png), `data:image/png;base64,${png}`);

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString("base64");
  assert.ok(checkToolImage(jpeg)?.startsWith("data:image/jpeg;base64,"));

  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).toString("base64");
  assert.ok(checkToolImage(webp)?.startsWith("data:image/webp;base64,"));
});

test("anything else the image tool sends back is refused", () => {
  assert.equal(checkToolImage(Buffer.from("<svg onload=alert(1)>").toString("base64")), null);
  assert.equal(checkToolImage("not base64 !!"), null);
  assert.equal(checkToolImage(""), null);
  assert.equal(checkToolImage(null), null);
  assert.equal(checkToolImage(42), null);
  // The label cannot be chosen by the tool: a data address in place of base64 text is refused.
  assert.equal(checkToolImage("data:image/png;base64,AAAA"), null);
});

test("a picture larger than the limit is refused", () => {
  const big = Buffer.concat([Buffer.from(PNG_HEAD), Buffer.alloc(MAX_TOOL_IMAGE_BYTES)]).toString("base64");
  assert.equal(checkToolImage(big), null);
});

test("the image tool address comes from IMAGE_GEN_URL and must be http or https", () => {
  const before = process.env.IMAGE_GEN_URL;
  try {
    process.env.IMAGE_GEN_URL = "http://localhost:5001/";
    assert.equal(configuredImageToolUrl(), "http://localhost:5001");
    process.env.IMAGE_GEN_URL = "file:///etc/passwd";
    assert.equal(configuredImageToolUrl(), null);
    delete process.env.IMAGE_GEN_URL;
    assert.equal(configuredImageToolUrl(), null);
  } finally {
    if (before === undefined) delete process.env.IMAGE_GEN_URL;
    else process.env.IMAGE_GEN_URL = before;
  }
});

test("an enlarged picture may be much larger than a made one, up to the limit", () => {
  assert.ok(MAX_TOOL_IMAGE_BYTES >= 3 * MAX_ENLARGE_INPUT_BYTES);
  const big = Buffer.concat([Buffer.from(PNG_HEAD), Buffer.alloc(20_000_000)]).toString("base64");
  assert.ok(checkToolImage(big)?.startsWith("data:image/png;base64,"));
});

test("only a PNG made here is sent to be enlarged, and nothing is called for anything else", async () => {
  const never = AbortSignal.timeout(1000);
  // None of these reach the network: they are refused first (the address is not even reachable).
  for (const bad of ["", "data:image/jpeg;base64,AAAA", "data:image/svg+xml;base64,PHN2Zy8+", "not a data address", "data:image/png;base64,"]) {
    const res = await enlargeToolPicture("http://127.0.0.1:1", bad, 2, never);
    assert.equal(res.ok, false, bad);
    if (!res.ok) assert.equal(res.status, 400, bad);
  }
  // Right label, wrong bytes: refused as well.
  const fake = `data:image/png;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`;
  const res = await enlargeToolPicture("http://127.0.0.1:1", fake, 2, never);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 400);
});

test("an enlarged picture is brought to exactly the size asked for", async () => {
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } }).png().toBuffer();
  const dims = async (b: Buffer) => { const m = await sharp(b).metadata(); return [m.width, m.height]; };
  const original = await png(64, 88);
  // A x4 upscaler asked for x2 is scaled back down to x2; asked for x4 it stays; asked for x3 it comes to x3.
  assert.deepEqual(await dims(await fitEnlarged(original, await png(256, 352), 2)), [128, 176]);
  assert.deepEqual(await dims(await fitEnlarged(original, await png(256, 352), 4)), [256, 352]);
  assert.deepEqual(await dims(await fitEnlarged(original, await png(256, 352), 3)), [192, 264]);
  // A model that gave less than was asked for is not stretched to fake it.
  assert.deepEqual(await dims(await fitEnlarged(original, await png(128, 176), 4)), [128, 176]);
});

// --- slow and failing image tools, with a small local server standing in for one ---
import http from "node:http";
import type { AddressInfo } from "node:net";
import { imageToolTimeoutMs, makeToolPicture, postJson } from "../lib/image-tool";

async function withServer<T>(handler: http.RequestListener, run: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
const PNG_B64 = Buffer.from([...PNG_HEAD, 1, 2, 3]).toString("base64");
const answer = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

test("the wait for the image tool is set by IMAGE_GEN_TIMEOUT_SECONDS, from 30 seconds to an hour, 15 minutes by default", () => {
  const before = process.env.IMAGE_GEN_TIMEOUT_SECONDS;
  try {
    delete process.env.IMAGE_GEN_TIMEOUT_SECONDS;
    assert.equal(imageToolTimeoutMs(), 900_000);
    process.env.IMAGE_GEN_TIMEOUT_SECONDS = "120";
    assert.equal(imageToolTimeoutMs(), 120_000);
    process.env.IMAGE_GEN_TIMEOUT_SECONDS = "5";
    assert.equal(imageToolTimeoutMs(), 30_000);
    process.env.IMAGE_GEN_TIMEOUT_SECONDS = "999999";
    assert.equal(imageToolTimeoutMs(), 3_600_000);
    for (const bad of ["abc", "", "-4", "0"]) {
      process.env.IMAGE_GEN_TIMEOUT_SECONDS = bad;
      assert.equal(imageToolTimeoutMs(), 900_000, bad);
    }
  } finally {
    if (before === undefined) delete process.env.IMAGE_GEN_TIMEOUT_SECONDS;
    else process.env.IMAGE_GEN_TIMEOUT_SECONDS = before;
  }
});

test("a picture comes back from a tool that is slow to answer", async () => {
  await withServer(
    (req, res) => { setTimeout(() => answer(res, 200, { images: [PNG_B64] }), 400); },
    async (url) => {
      const result = await makeToolPicture(url, "a lantern", "cards", AbortSignal.timeout(5000));
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.value, `data:image/png;base64,${PNG_B64}`);
    }
  );
});

test("a tool that is too slow ends with a plain message about the time, not about being unreachable", async () => {
  await withServer(
    (req, res) => { setTimeout(() => answer(res, 200, { images: [PNG_B64] }), 3000); },
    async (url) => {
      const result = await makeToolPicture(url, "a lantern", "cards", AbortSignal.timeout(200));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 504);
        assert.match(result.error, /did not finish within \d+ minutes/);
        assert.match(result.error, /IMAGE_GEN_TIMEOUT_SECONDS/);
      }
    }
  );
});

test("pressing Stop ends the wait at once and says so", async () => {
  await withServer(
    (req, res) => { setTimeout(() => answer(res, 200, { images: [PNG_B64] }), 3000); },
    async (url) => {
      const stop = new AbortController();
      setTimeout(() => stop.abort(), 150);
      const t0 = Date.now();
      const result = await makeToolPicture(url, "a lantern", "cards", stop.signal);
      assert.ok(Date.now() - t0 < 1500, "did not wait for the tool");
      assert.deepEqual(result, { ok: false, status: 499, error: "Stopped." });
    }
  );
});

test("a tool that errors or sends nonsense is reported, and one that is not there is reported as unreachable", async () => {
  await withServer((req, res) => answer(res, 500, { error: "boom" }), async (url) => {
    const r = await makeToolPicture(url, "x", "cards", AbortSignal.timeout(3000));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /answered with an error \(500\)/);
  });
  await withServer((req, res) => answer(res, 200, { images: ["PHN2ZyBvbmxvYWQ9MT4="] }), async (url) => {
    const r = await makeToolPicture(url, "x", "cards", AbortSignal.timeout(3000));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /did not send a picture back/);
  });
  const gone = await makeToolPicture("http://127.0.0.1:1", "x", "cards", AbortSignal.timeout(3000));
  assert.equal(gone.ok, false);
  if (!gone.ok) {
    assert.equal(gone.status, 502);
    assert.match(gone.error, /could not reach the image tool/);
  }
});

test("postJson sends JSON, reads JSON, and refuses an answer larger than its limit", async () => {
  await withServer(
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const sent = JSON.parse(Buffer.concat(chunks).toString());
        if (sent.big) return answer(res, 200, { filler: "x".repeat(5000) });
        answer(res, 200, { echoed: sent.hello });
      });
    },
    async (url) => {
      const ok = await postJson(url, { hello: "world" }, AbortSignal.timeout(3000));
      assert.deepEqual(ok, { status: 200, json: { echoed: "world" } });
      await assert.rejects(postJson(url, { big: true }, AbortSignal.timeout(3000), 1000), /too large/);
    }
  );
});
