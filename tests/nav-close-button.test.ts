import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sideNavFor } from "../lib/nav-groups";

// The owner's request (2026-10-30, moved from the Your tools row of 2026-10-26): the menu's ✕ sits in the same row as the
// Days link, at the very top, in the desktop column and the phone drawer, and stays there. It moved away more than once
// while the side menu was being changed, so this pins it.

const navBody = readFileSync("components/nav/NavBody.tsx", "utf8");

test("the close button is drawn inside the top row, after the Days link, above Your tools", () => {
  const row = navBody.match(/nav\.top\.map\(\(item, i\) => \(\s*<li[^>]*className="flex items-center[^"]*">([\s\S]*?)<\/li>/);
  assert.ok(row, "the top row (Days) is a flex <li>");
  const body = row[1];
  const link = body.indexOf("link(item)");
  const close = body.indexOf('aria-label="Close menu"');
  assert.ok(link >= 0, "the row holds the Days link");
  assert.ok(close > link, "the ✕ is in the same row, after the link");
  assert.match(body, /i === 0 && onClose/, "only the first top row carries it");
  assert.ok(navBody.indexOf('aria-label="Close menu"') < navBody.indexOf("TOOLS_LINK.label"), "the ✕ comes before Your tools");
  assert.match(body, /data-nav-close/);
  assert.match(body, /onClick=\{onClose\}/);
  // It hides with the words when the desktop column is narrowed to its pictures.
  assert.match(body, /nav-wide-only/);
});

test("Days is the top row on every kind of copy, so the close button always has its row", () => {
  for (const edition of ["hosted", "host", "local", "feathered"] as const) {
    for (const admin of [false, true]) assert.equal(sideNavFor(admin, edition).top[0]?.id, "days", edition);
  }
});

test("NavBody draws the only close button, and both menus hand it their close action", () => {
  assert.equal(navBody.match(/aria-label="Close menu"/g)?.length, 1);
  for (const file of ["components/SideNav.tsx", "components/MobileNav.tsx"]) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /aria-label="Close menu"/, `${file} must not draw a close button of its own`);
    assert.match(src, /<NavBody[\s\S]*?onClose=\{/, `${file} passes onClose to NavBody`);
  }
});

test("the drawer still puts focus on the close button when it opens", () => {
  assert.match(readFileSync("components/MobileNav.tsx", "utf8"), /querySelector<HTMLElement>\("\[data-nav-close\]"\)\?\.focus\(\)/);
});
