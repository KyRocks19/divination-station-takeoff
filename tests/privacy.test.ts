import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PRIVACY_VERSION, safeFrom } from "../lib/privacy";
import PrivacyNotice from "../components/PrivacyNotice";
import type { Shape } from "../lib/edition";

test("after the privacy screen only a path on this site is followed, and never the screen itself", () => {
  assert.equal(safeFrom("/readings/4"), "/readings/4");
  assert.equal(safeFrom("//evil.example"), "/");
  assert.equal(safeFrom("https://evil.example"), "/");
  assert.equal(safeFrom("/welcome?from=/"), "/");
  assert.equal(safeFrom(undefined), "/");
  assert.equal(safeFrom(["/x"]), "/");
});

test("the version is a positive whole number", () => {
  assert.ok(Number.isInteger(PRIVACY_VERSION) && PRIVACY_VERSION >= 1);
});

// Each person reads one notice, built from the layers that fit their copy, so the words are checked as each copy shows them.
const notice = (shape: Shape) =>
  renderToStaticMarkup(createElement(PrivacyNotice, { shape }))
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&rsquo;|’/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ");
const shapes: Shape[] = ["feathered", "local", "host", "hosted"];

test("every notice tells the plain facts: where the writing is, the quick hide, searching, export, backups and help lines", () => {
  for (const shape of shapes) {
    const text = notice(shape).toLowerCase();
    for (const needle of ["quick hide", "off until you do", "export everything", "backups", "i am 18 or older", "for reflection"]) {
      assert.ok(text.includes(needle), shape + " mentions " + needle);
    }
    assert.ok(!/\[[^\]]*\]/.test(text), shape + ": no bracketed placeholder text is shown to people");
  }
});

test("each idea is said once in a notice", () => {
  for (const shape of shapes) {
    const headings = [...renderToStaticMarkup(createElement(PrivacyNotice, { shape })).matchAll(/<h2[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.equal(new Set(headings).size, headings.length, shape + " repeats a heading: " + headings.join(", "));
  }
});

test("each kind of copy says who can read the writing, and only Winged copies speak of Claude, the companion and pictures", () => {
  const feathered = notice("feathered");
  assert.match(feathered, /connects to nothing outside this computer/);
  assert.match(feathered, /recovery code/);
  assert.doesNotMatch(feathered, /companion|Claude|passkey|the forum|Anthropic/i, "the Feathered edition has no AI, passkeys or forum");

  const local = notice("local");
  assert.match(local, /my-data folder beside the app/);
  assert.match(local, /recovery code/);
  assert.match(local, /only one account/);
  for (const needle of ["Anthropic", "not crisis support", "image program", "passkey"]) assert.ok(local.includes(needle), "local mentions " + needle);
  assert.doesNotMatch(local, /owner's own computer|the forum/, "a copy for one person has no owner's computer and no forum");

  const host = notice("host");
  assert.match(host, /the host can read it/);
  assert.match(host, /Tailscale or Headscale/);
  assert.match(host, /report a post/);

  const hosted = notice("hosted");
  for (const needle of ["not end-to-end encrypted", "Anthropic", "not crisis support", "image program", "report a post", "60 days", "This is a beta"]) {
    assert.ok(hosted.includes(needle), "hosted mentions " + needle);
  }
  assert.doesNotMatch(hosted, /Locking your writing|my-data/, "the website has no folder to lock");

  const source = readFileSync("components/PrivacyNotice.tsx", "utf8").replace(/\s+/g, " ");
  assert.match(source, /shape === "local" \? LocalNotice : shape === "host" \? HostNotice : shape === "feathered" \? FeatheredNotice : HostedNotice/);
});

test("the privacy page is public and the screen is only for signed-in people", () => {
  assert.match(readFileSync("proxy.ts", "utf8"), /PUBLIC_PATHS = \[[^\]]*"\/privacy"/);
  assert.match(readFileSync("app/welcome/page.tsx", "utf8"), /redirect\("\/login"\)/);
});
