// Checks on the picture studio's test screen (`--check`): its plain words, and that the studio package has the files a lender needs. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { formatCheck, imageProgramLine, pictureLine, settingsLines, websiteLine } from "../lib/studio-check-core";

const goodToken = "dsw_" + "A".repeat(43);

test("settings: a good set is all OK, and each missing one says what to do", () => {
  const good = settingsLines({ APP_URL: "https://example.org", WORKER_TOKEN: goodToken, IMAGE_GEN_URL: "http://localhost:5001" });
  assert.ok(good.every((l) => l.ok));
  assert.ok(!JSON.stringify(good).includes(goodToken), "the token is never printed");

  const bad = settingsLines({ APP_URL: "http://example.org", WORKER_TOKEN: "dsw_short", IMAGE_GEN_URL: "" });
  assert.equal(bad.filter((l) => !l.ok).length, 3);
  for (const l of bad) assert.ok(l.fix && l.fix.length > 10, `${l.name} has a "what to do"`);
  assert.ok(!JSON.stringify(bad).includes("dsw_short"), "a mistyped token is not printed either");
});

test("the website's answer: accepted, refused, unreachable, other error", () => {
  const url = "https://example.org";
  const ok = websiteLine({ ok: true, name: "Ana's PC", pictures: true, companion: false, circle: true }, url);
  assert.ok(ok.ok && ok.said.includes("Ana's PC") && ok.said.includes("circle") && ok.said.includes("make pictures"));
  assert.ok(!websiteLine({ ok: true, name: "x", pictures: false, companion: false }, url).ok, "a token that may do nothing is a problem");
  assert.match(websiteLine({ ok: false, status: 401, message: "no" }, url).said, /did not accept/);
  const down = websiteLine({ ok: false, status: 0, message: "could not reach the website (fetch failed)" }, url);
  assert.match(down.said, /^Could not reach the website \(fetch failed\)\. Address tried: https:\/\/example\.org$/);
  assert.match(websiteLine({ ok: false, status: 500, message: "boom" }, url).said, /error \(500\)/);
});

test("the image program and the test picture", () => {
  assert.ok(imageProgramLine({ ok: true }, "http://localhost:5001").ok);
  const down = imageProgramLine({ ok: false, error: "refused" }, "http://localhost:5001");
  assert.ok(!down.ok && /Start the image program/.test(down.fix!));
  assert.ok(pictureLine({ ok: true, seconds: 20 }).fix === undefined);
  assert.ok(/slow/.test(pictureLine({ ok: true, seconds: 400 }).fix!), "a very slow picture is noted");
  assert.ok(!pictureLine({ ok: false, error: "no model" }).ok);
});

test("the report ends by saying whether the computer is ready", () => {
  const all = formatCheck([{ ok: true, name: "A", said: "fine" }]);
  assert.ok(all.allOk && /You can start the picture studio/.test(all.text));
  const some = formatCheck([{ ok: true, name: "A", said: "fine" }, { ok: false, name: "B", said: "broken", fix: "mend it" }]);
  assert.ok(!some.allOk && /PROBLEM B: broken/.test(some.text) && /What to do: mend it/.test(some.text));
  assert.ok(!formatCheck([]).allOk, "nothing checked is not ready");
});

test("the package builder and its guide exist, and the studio takes --check", () => {
  const root = path.join(__dirname, "..");
  for (const f of ["scripts/build-studio-package.ts", "docs/picture-studio-download.md", "app/api/worker/check/route.ts", "lib/studio-check.ts"]) assert.ok(existsSync(path.join(root, f)), f);
  const worker = readFileSync(path.join(root, "scripts/image-worker.ts"), "utf8");
  assert.ok(worker.includes('"--check"') && worker.includes("studio\\.mjs"));
  const builder = readFileSync(path.join(root, "scripts/build-studio-package.ts"), "utf8");
  assert.ok(builder.includes("lib\\/db\\.ts"), "the builder refuses a bundle that holds database code");
  const route = readFileSync(path.join(root, "app/api/worker/check/route.ts"), "utf8");
  assert.ok(!/recordHeartbeat|requeueStale/.test(route), "the check route changes nothing");
});
