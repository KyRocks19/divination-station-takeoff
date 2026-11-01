import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDevice, cleanFeedback, cleanPage } from "../lib/feedback";

test("a note needs a known kind and some words, and keeps only a page path", () => {
  const ok = cleanFeedback({ kind: "bug", message: "  It stopped  ", page: "/oracle/cards/12?x=1#top", device: "  Firefox   on\nAndroid " });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.input, { kind: "bug", message: "It stopped", page: "/oracle/cards/12", device: "Firefox on Android" });
  }
  assert.ok(!cleanFeedback({ kind: "rant", message: "x" }).ok);
  assert.ok(!cleanFeedback({ kind: "idea", message: "   " }).ok);
  assert.ok(!cleanFeedback({ kind: "idea", message: "x".repeat(4001) }).ok);
  assert.ok(!cleanFeedback(null).ok);
});

test("only a path on this site is kept as the page", () => {
  assert.equal(cleanPage("/readings/4"), "/readings/4");
  assert.equal(cleanPage("https://evil.example/x"), null);
  assert.equal(cleanPage("//evil.example/x"), null);
  assert.equal(cleanPage(42), null);
  assert.equal(cleanPage("/" + "a".repeat(500))?.length, 300);
  assert.equal(cleanDevice("   "), null);
  assert.equal(cleanDevice(undefined), null);
});
