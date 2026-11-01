import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION, SOURCE_URL } from "../lib/app-version";

test("the About page's version is the package.json version", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(APP_VERSION, pkg.version);
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+/);
});

test("the About page shows the version and links to the source", () => {
  const page = readFileSync("app/about/page.tsx", "utf8");
  assert.match(page, /\{APP_VERSION\}/);
  assert.match(page, /href=\{SOURCE_URL\}/);
  assert.match(SOURCE_URL, /^https:\/\//);
});
