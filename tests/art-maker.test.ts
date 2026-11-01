import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BATCH,
  IMAGE_SIZE,
  LOCAL_IMAGE_TOOL,
  MAX_BATCH,
  MAX_SCENE_LENGTH,
  MAX_STYLE_LENGTH,
  cleanBatch,
  cleanImageToolUrl,
  cleanMadeWith,
  imageSizeFor,
  joinPrompt,
  MAX_FAILURES_IN_A_ROW,
  shouldGoOn,
  suggestAlt,
} from "../lib/art-maker";
import { parseImageDataUrl } from "../lib/oracle-gallery";
import { parseOracleArtMakerDraft } from "../lib/oracle-art-draft-core";
import { MAX_ALT_LENGTH } from "../lib/oracle-art";

test("made_with accepts only the known note", () => {
  assert.equal(cleanMadeWith(LOCAL_IMAGE_TOOL), LOCAL_IMAGE_TOOL);
  assert.equal(cleanMadeWith("something else"), null);
  assert.equal(cleanMadeWith(null), null);
  assert.equal(cleanMadeWith(5), null);
});

test("batch size is a whole number from 1 to MAX_BATCH", () => {
  assert.equal(cleanBatch(1), 1);
  assert.equal(cleanBatch(MAX_BATCH), MAX_BATCH);
  assert.equal(cleanBatch(MAX_BATCH + 1), DEFAULT_BATCH);
  assert.equal(cleanBatch(0), DEFAULT_BATCH);
  assert.equal(cleanBatch(2.5), DEFAULT_BATCH);
  assert.equal(cleanBatch("3"), 3);
  assert.equal(cleanBatch(String(MAX_BATCH + 2)), DEFAULT_BATCH);
  assert.equal(cleanBatch("abc"), DEFAULT_BATCH);
});

test("the image tool address must be http or https and loses a trailing slash", () => {
  assert.equal(cleanImageToolUrl("http://localhost:5001"), "http://localhost:5001");
  assert.equal(cleanImageToolUrl(" http://localhost:5001/ "), "http://localhost:5001");
  assert.equal(cleanImageToolUrl("https://tool.example/api/"), "https://tool.example/api");
  assert.equal(cleanImageToolUrl("javascript:alert(1)"), null);
  assert.equal(cleanImageToolUrl("file:///etc/passwd"), null);
  assert.equal(cleanImageToolUrl("localhost:5001"), null);
  assert.equal(cleanImageToolUrl(""), null);
  assert.equal(cleanImageToolUrl(undefined), null);
});

test("the prompt joins the scene and the optional style note", () => {
  assert.equal(joinPrompt("a lantern", "ink drawing"), "a lantern, ink drawing");
  assert.equal(joinPrompt("a lantern", "  "), "a lantern");
  assert.equal(joinPrompt("  ", ""), "");
  // The composition hint goes between the scene and the style note, and is left out when empty.
  assert.equal(joinPrompt("a lantern", "ink drawing", "portrait, one subject"), "a lantern, portrait, one subject, ink drawing");
  assert.equal(joinPrompt("a lantern", "", ""), "a lantern");
});

test("the suggested description comes from the scene and is short", () => {
  assert.equal(suggestAlt("A  lantern\non a path"), "A lantern on a path");
  const long = suggestAlt("word ".repeat(200));
  assert.ok(long.length <= 300);
  assert.ok(long.endsWith("…"));
});

test("an image-maker draft restores valid fields and ignores invalid values", () => {
  assert.deepEqual(
    parseOracleArtMakerDraft({
      version: 1,
      selected: ["origin", "missing", 3],
      scene: "a scene",
      sceneEdited: true,
      style: "ink",
      styleName: "soft",
      useComposition: false,
      count: 2,
      alt: "a description",
      altEdited: true,
    }, ["origin", "meaning"]),
    {
      selected: ["origin"],
      scene: "a scene",
      sceneEdited: true,
      style: "ink",
      styleName: "soft",
      useComposition: false,
      count: 2,
      alt: "a description",
      altEdited: true,
    }
  );
  const bounded = parseOracleArtMakerDraft({
    version: 1,
    scene: "s".repeat(MAX_SCENE_LENGTH + 1),
    style: "s".repeat(MAX_STYLE_LENGTH + 1),
    count: MAX_BATCH + 1,
    alt: "a".repeat(MAX_ALT_LENGTH + 1),
  }, []);
  assert.equal(bounded?.scene?.length, MAX_SCENE_LENGTH);
  assert.equal(bounded?.style?.length, MAX_STYLE_LENGTH);
  assert.equal(bounded?.count, DEFAULT_BATCH);
  assert.equal(bounded?.alt?.length, MAX_ALT_LENGTH);
  assert.equal(parseOracleArtMakerDraft({ version: 2, scene: "old draft" }, ["origin"]), null);
  assert.equal(parseOracleArtMakerDraft(null, ["origin"]), null);
});

test("every picture size is a multiple of 64 and keeps the shape of its form", () => {
  for (const { width, height } of Object.values(IMAGE_SIZE)) {
    assert.equal(width % 64, 0);
    assert.equal(height % 64, 0);
  }
  assert.ok(imageSizeFor("cards").height > imageSizeFor("cards").width);
  assert.equal(imageSizeFor("stones").width, imageSizeFor("stones").height);
  assert.ok(imageSizeFor("staves").height > imageSizeFor("staves").width * 2);
  assert.deepEqual(imageSizeFor("nonsense"), imageSizeFor("cards"));
});

test("a gallery picture must be a real JPEG, PNG, or WebP of at most 1 MB", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const ok = parseImageDataUrl(`data:image/png;base64,${png.toString("base64")}`);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.mime, "image/png");

  // A label that says PNG over bytes that are not one is refused.
  const fake = parseImageDataUrl(`data:image/png;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`);
  assert.equal(fake.ok, false);
  if (!fake.ok) assert.equal(fake.status, 415);

  // SVG is refused by its label.
  const svg = parseImageDataUrl(`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`);
  assert.equal(svg.ok, false);
  if (!svg.ok) assert.equal(svg.status, 400);

  const big = Buffer.concat([png, Buffer.alloc(1_000_001)]);
  const tooBig = parseImageDataUrl(`data:image/png;base64,${big.toString("base64")}`);
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.equal(tooBig.status, 413);

  assert.equal(parseImageDataUrl(undefined).ok, false);
});

test("a batch carries on after a one-off failure, but not when nothing later is likely to work", () => {
  // A one-off error from the tool, or the app being briefly unreachable (status 0), is worth trying the next picture after.
  for (const status of [0, 400, 500, 502, 409]) assert.equal(shouldGoOn(status), true, String(status));
  // Signed out, switched off, busy, stopped, no address, or timed out will not be different a moment later.
  for (const status of [401, 403, 429, 499, 503, 504]) assert.equal(shouldGoOn(status), false, String(status));
  assert.equal(MAX_FAILURES_IN_A_ROW, 2);
});
