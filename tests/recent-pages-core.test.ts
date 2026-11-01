import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RECENT_MAX, addRecent, cleanTitle, parseRecent, recordable } from "../lib/recent-pages-core";
import { NAV_BOOT_SCRIPT, NAV_WIDTH_KEY } from "../lib/nav-width";

test("only pages deeper than the menu's own links are listed", () => {
  for (const ok of ["/readings/12", "/cards/cups-5", "/runes/draw/3", "/dice/7", "/archetypes/the-threshold", "/runes", "/blots"]) {
    assert.equal(recordable(ok), true, ok);
  }
  for (const no of ["/", "/readings", "/library", "/insights", "/settings", "/design", "/admin/users", "/login", "/welcome", "/privacy"]) {
    assert.equal(recordable(no), false, no);
  }
});

test("an address that could leave the site, or carries a query, is never listed", () => {
  for (const bad of ["//evil.example/x", "https://evil.example/x", "readings/12", "/readings/12?x=1", "/readings/12#a", "", "javascript:alert(1)"]) {
    assert.equal(recordable(bad), false, bad);
  }
});

test("a page title loses the site's name, and says nothing when nothing is left", () => {
  assert.equal(cleanTitle("Cups 5 · Divination Station"), "Cups 5");
  assert.equal(cleanTitle("  Reading: a hard week · Divination Station "), "Reading: a hard week");
  assert.equal(cleanTitle("Divination Station"), null);
  assert.equal(cleanTitle(" · Divination Station"), null);
  assert.equal(cleanTitle(""), null);
  const long = cleanTitle("x".repeat(200) + " · Divination Station")!;
  assert.ok(long.length <= 80 && long.endsWith("…"), long);
});

test("the newest page goes first, a repeat moves up instead of doubling, and the list is cut", () => {
  let list = addRecent([], { path: "/a/1", title: "A" });
  list = addRecent(list, { path: "/b/1", title: "B" });
  list = addRecent(list, { path: "/a/1", title: "A again" });
  assert.deepEqual(list.map((p) => p.path), ["/a/1", "/b/1"]);
  assert.equal(list[0].title, "A again");
  for (let i = 0; i < 20; i++) list = addRecent(list, { path: `/n/${i}`, title: `N${i}` });
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0].path, "/n/19");
});

test("a saved list is read back only when every part is a plain page", () => {
  const good = JSON.stringify([{ path: "/readings/3", title: "One · Divination Station" }, { path: "/dice/4", title: "Two" }]);
  assert.deepEqual(parseRecent(good), [{ path: "/readings/3", title: "One" }, { path: "/dice/4", title: "Two" }]);
  for (const junk of [null, undefined, "", "not json", "{}", "42", '"x"', "[1,2]", '[{"path":1,"title":"x"}]', '[{"path":"https://x.y/z","title":"x"}]', '[{"path":"/a/b"}]']) {
    assert.deepEqual(parseRecent(junk as string | null | undefined), [], String(junk));
  }
  const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ path: `/p/${i}`, title: `T${i}` })));
  assert.equal(parseRecent(many).length, RECENT_MAX);
});

// ── the narrow menu's head script ───────────────────────────────────────────────────────────────

function runBoot(storage: { getItem(k: string): string | null } | "throws") {
  const attrs: Record<string, string> = {};
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  const localStorage = storage === "throws" ? { getItem: () => { throw new Error("blocked"); } } : storage;
  new Function("document", "localStorage", NAV_BOOT_SCRIPT)(document, localStorage);
  return attrs;
}

test("the head script narrows the menu only when the person chose it", () => {
  assert.deepEqual(runBoot({ getItem: (k) => (k === NAV_WIDTH_KEY ? "narrow" : null) }), { "data-nav": "narrow" });
  assert.deepEqual(runBoot({ getItem: () => null }), {});
  assert.deepEqual(runBoot({ getItem: () => "wide" }), {});
});

test("the head script does nothing, and does not throw, when storage is blocked", () => {
  assert.deepEqual(runBoot("throws"), {});
});

test("the layout puts the narrow-menu script in the head, with the page's nonce", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<script nonce=\{nonce\} dangerouslySetInnerHTML=\{\{ __html: NAV_BOOT_SCRIPT \}\} \/>/);
});

test("the narrow rules only apply from the width where the column shows, and outside the layers on purpose", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@media \(min-width: 64rem\) \{\s*html\[data-nav="narrow"\] \.sidenav \{\s*width: 3\.5rem;/);
});

test("the full menu floats over the page, keeping only the narrow menu's width in the row", () => {
  const css = readFileSync("app/globals.css", "utf8");
  // 14rem wide (w-56) less 10.5rem leaves the narrow column's 3.5rem, so the page does not move when the menu is widened.
  assert.match(css, /@media \(min-width: 64rem\) \{\s*html:not\(\[data-nav="narrow"\]\) \.sidenav \{\s*margin-right: -10\.5rem;\s*z-index: 40;/);
  assert.match(readFileSync("components/SideNav.tsx", "utf8"), /\bw-56\b/);
});
