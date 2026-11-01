import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FeatheredAlone, FullCircle, SmallCircle, TwoHosts } from "../components/circles/CirclePictures";

// The pictures on "Circles and Tailscale" (app/guide/circles). They are all drawn on one page, so the clip names must not collide.
const pictures = { FeatheredAlone, SmallCircle, FullCircle, TwoHosts };
const html = Object.fromEntries(Object.entries(pictures).map(([k, C]) => [k, renderToStaticMarkup(createElement(C))]));

test("each picture is one image with a description, and no style attribute", () => {
  for (const [name, h] of Object.entries(html)) {
    assert.equal((h.match(/<svg/g) ?? []).length, 1, name);
    assert.match(h, /role="img" aria-label="[^"]{40,}"/, name);
    assert.doesNotMatch(h, /style=/, name);
  }
});

test("the clip names are unique across the whole page", () => {
  const ids = Object.values(html).flatMap((h) => [...h.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length);
});

test("each picture shows the number of friends and hosts its caption says", () => {
  const count = (h: string) => (h.match(/<clipPath /g) ?? []).length;
  const threads = (h: string) => (h.match(/circle-thread/g) ?? []).length;
  assert.equal(count(html.FeatheredAlone), 1);
  assert.equal(threads(html.FeatheredAlone), 0, "nobody is joined to a Feathered copy");
  assert.equal(count(html.SmallCircle), 3);
  assert.equal(count(html.FullCircle), 9);
  assert.equal(count(html.TwoHosts), 7);
  assert.equal(threads(html.TwoHosts), 8, "three friends per host, and one friend joined to both");
});

test("the page explains Feathered before Winged, circles and Tailscale", () => {
  const page = readFileSync("app/guide/circles/page.tsx", "utf8");
  const at = (s: string) => page.indexOf(s);
  assert.ok(at("The Feathered edition is") > 0);
  assert.ok(at("The Feathered edition is") < at("The Winged edition is"));
  assert.ok(at("The Winged edition is") < at("Tailscale</strong>, a free"));
  assert.match(page, /the host can read it/);
});
