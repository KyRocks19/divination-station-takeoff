import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DIVINATION_KINDS } from "../lib/divination-kinds";
import {
  DEFAULT_NAV_FOLDED,
  NAV_FOLD_KEYS,
  NAV_GROUPS,
  TOOLS_LINK,
  TOOL_ITEMS,
  activeItemId,
  cleanNavFolded,
  groupsFor,
  onSettings,
  parseNavFolded,
  sideNavFor,
  toggleFold,
  toggleStar,
  visibleTools,
} from "../lib/nav-groups";

test("the groups are Your tools, Your writings, Your people, Learn, Help and about, and Admin, in that order", () => {
  assert.deepEqual(NAV_GROUPS.map((g) => g.label), ["Your tools", "Your writings", "Your people", "Learn", "Help and about", "Admin"]);
  const labels = (id: string) => NAV_GROUPS.find((g) => g.id === id)!.items.map((i) => i.label);
  assert.deepEqual(labels("writing"), ["Days", "Readings", "Journals", "Patterns", "Predictions", "Questions", "Layouts"]);
  assert.deepEqual(labels("people"), ["Forum", "Letters", "Your circle"]);
  assert.deepEqual(labels("learn"), ["Library", "Sources"]);
  assert.deepEqual(labels("help"), ["How this works", "Send feedback", "About"]);
  assert.deepEqual(labels("admin"), ["Users", "Forum reports", "Picture computers", "Admin log", "Host a circle"]);
});

test("the side navigation draws Days first, above Your tools and outside every group", () => {
  const { top, groups } = sideNavFor(false);
  assert.deepEqual(top.map((i) => i.id), ["days"]);
  assert.ok(groups.every((g) => g.items.every((i) => i.id !== "days")));
  assert.equal(groups.find((g) => g.id === "writing")!.items[0].id, "readings");
  const body = readFileSync("components/nav/NavBody.tsx", "utf8");
  assert.ok(body.indexOf("nav.top.map") < body.indexOf("nav.groups.map"), "Days is drawn before Your tools");
});

test("Settings and Log out live in the header bar, not in the navigation", () => {
  const items = NAV_GROUPS.flatMap((g) => g.items);
  assert.ok(!items.some((i) => i.href === "/settings" || /log ?out/i.test(i.label)));
  assert.ok(onSettings("/settings") && onSettings("/design") && onSettings("/settings/anything"));
  assert.ok(!onSettings("/") && !onSettings("/settingsx") && !onSettings("/designs"));
});

test("every item has a picture, so the home page tiles can be drawn from the same groups", () => {
  for (const item of NAV_GROUPS.flatMap((g) => g.items)) assert.ok(item.icon, `${item.label} has no picture`);
});

test("the Tools group has one item for every tool, from the kinds file", () => {
  assert.equal(TOOL_ITEMS.length, DIVINATION_KINDS.length);
  assert.deepEqual(TOOL_ITEMS.map((t) => t.kind), DIVINATION_KINDS);
  assert.ok(TOOL_ITEMS.every((t) => t.href && t.icon));
});

test("every address in the navigation is a real page", () => {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.href) continue;
      const path = `app${item.href === "/" ? "" : item.href}/page.tsx`;
      assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${item.label} points at ${item.href}, but ${path} does not exist`);
    }
  }
});

test("ids are unique and only Send feedback is an action", () => {
  const items = NAV_GROUPS.flatMap((g) => g.items);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  assert.deepEqual(items.filter((i) => i.action).map((i) => i.id), ["feedback"]);
  assert.ok(items.filter((i) => !i.action).every((i) => i.href));
});

test("a person who chose some tools sees those first, and the rest are kept", () => {
  assert.deepEqual(visibleTools(null).shown.length, DIVINATION_KINDS.length);
  assert.deepEqual(visibleTools(null).rest, []);
  const some = visibleTools(["runes", "tarot"]);
  assert.deepEqual(some.shown.map((t) => t.kind), ["tarot", "runes"]);
  assert.equal(some.shown.length + some.rest.length, DIVINATION_KINDS.length);
});

test("starring and unstarring a tool", () => {
  const all = DIVINATION_KINDS.length;
  // From every tool (null), unstarring one leaves the others, in the app's order.
  const one = toggleStar(null, "runes")!;
  assert.equal(one.starred, false);
  assert.equal(one.next!.length, all - 1);
  assert.ok(!one.next!.includes("runes"));
  // Starring a tool puts it in its place in the app's order, not at the end.
  assert.deepEqual(toggleStar(["runes"], "tarot"), { next: ["tarot", "runes"], starred: true });
  // Starring the last unstarred tool goes back to "every tool".
  assert.deepEqual(toggleStar(one.next, "runes"), { next: null, starred: true });
  // The only starred tool cannot be unstarred: pages that follow the choice need at least one.
  assert.equal(toggleStar(["ogham"], "ogham"), null);
});

test("administrator links are hidden from everyone else, and so is their empty group", () => {
  const ids = (admin: boolean) => groupsFor(admin).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(ids(true).includes("users") && ids(true).includes("reports") && ids(true).includes("workers"));
  assert.ok(!ids(false).includes("users") && !ids(false).includes("reports") && !ids(false).includes("workers"));
  assert.ok(!groupsFor(false).some((g) => g.id === "admin"));
  assert.ok(groupsFor(true).some((g) => g.id === "admin"));
});

test("one item is marked for a page: the longest matching address wins", () => {
  const cases: [string, string | null][] = [
    ["/", null],
    ["/readings", "readings"],
    ["/readings/new", "readings"],
    ["/readings/12", "readings"],
    ["/insights", "patterns"],
    ["/oracle", "tool-oracle"],
    ["/oracle/pulls/3", "tool-oracle"],
    ["/oracle/gallery", "tool-oracle"],
    ["/runes/set", "tool-runes"],
    ["/dice/new", "tool-dice"],
    ["/tarot", "tool-tarot"],
    ["/cards/major-0", "tool-tarot"],
    ["/encyclopedia/the-sea", "tool-tarot"],
    ["/forum", "forum"],
    ["/forum/12", "forum"],
    ["/forum/reports", "reports"],
    ["/library", "library"],
    ["/archetypes/hearth", "library"],
    ["/sources/runes", "sources"],
    ["/guide", "guide"],
    ["/settings", null],
    ["/design", null],
    ["/feedback", null],
    ["/admin/users", "users"],
    ["/admin/workers", "workers"],
    ["/admin/log", "adminlog"],
    ["/privacy", "about"],
    ["/layouts/4", "layouts"],
    ["/days/2026-10-15", "days"],
    ["/predictions", "predictions"],
    ["/questions", "questions"],
    ["/somewhere-else", null],
  ];
  for (const [path, expected] of cases) assert.equal(activeItemId(path), expected, path);
});

test("the navigation data imports only the kinds file: no database or browser code", () => {
  const source = readFileSync(new URL("../lib/nav-groups.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  // ./edition is the type of the kinds of copy (Feathered, 2026-10-22); it imports nothing.
  assert.deepEqual(imports, ["./edition", "./divination-kinds"]);
});

test("the navigation components import only the navigation data, the kinds file and each other", () => {
  const importsOf = (f: string) => [...readFileSync(new URL(`../${f}`, import.meta.url), "utf8").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(importsOf("components/nav/NavBody.tsx"), ["@/components/FeedbackDialog", "@/components/NewReadingMenu", "@/components/nav/RecentPages", "@/components/nav/logout", "@/components/ui/NavGlyph", "@/lib/divination-kinds", "@/lib/edition", "@/lib/nav-groups", "next/link", "next/navigation", "react"]);
  // NavGlyph (T16) is one more drawings file like ToolGlyph: it imports nothing.
  assert.deepEqual(importsOf("components/ui/NavGlyph.tsx"), []);
  // SideNav and MobileNav take the type of the folded parts of the menu from the navigation data (2026-10-23).
  assert.deepEqual(importsOf("components/SideNav.tsx"), ["@/components/nav/NavBody", "@/lib/divination-kinds", "@/lib/edition", "@/lib/nav-groups", "@/lib/nav-width", "react"]);
  // The Recent list and the narrow menu keep to browser-safe files: the pure list rules, the device storage, nothing with a database.
  assert.deepEqual(importsOf("components/nav/RecentPages.tsx"), ["@/components/ui/NavGlyph", "@/lib/recent-pages-core", "@/lib/recent-pages-store", "next/link", "next/navigation", "react"]);
  assert.deepEqual(importsOf("lib/recent-pages-core.ts"), ["./nav-groups"]);
  assert.deepEqual(importsOf("lib/recent-pages-store.ts"), ["./recent-pages-core"]);
  assert.deepEqual(importsOf("lib/nav-width.ts"), []);
  // The drawer opens below the header bar, placed from script with styleRef (2026-10-25); lib/apply-style imports nothing.
  assert.deepEqual(importsOf("components/MobileNav.tsx"), ["@/components/nav/NavBody", "@/lib/apply-style", "@/lib/divination-kinds", "@/lib/edition", "@/lib/nav-groups", "next/navigation", "react", "react-dom"]);
  // The header mounts the quick exit's ways (Esc twice, the tap, the shake, leaving the page); they moved out of it on 2026-10-22, taking its only React hook.
  assert.deepEqual(importsOf("components/AppHeader.tsx"), ["@/components/MobileNav", "@/components/NewReadingMenu", "@/components/QuickExitTriggers", "@/components/SiteSearch", "@/components/nav/NavBody", "@/components/nav/logout", "@/components/ui/AppSigil", "@/components/ui/NavGlyph", "@/lib/divination-kinds", "@/lib/edition", "@/lib/nav-groups", "next/link", "next/navigation"]);
  // The app's logo (2026-10-26): pure drawing data, no database and nothing else.
  assert.deepEqual(importsOf("components/ui/AppSigil.tsx"), ["@/lib/app-sigil-core"]);
  assert.deepEqual(importsOf("lib/app-sigil-core.ts"), []);
  assert.deepEqual(importsOf("components/QuickExitTriggers.tsx"), ["@/components/nav/logout", "@/lib/quick-exit-core", "react"]);
  // The search window asks the server for results; in the browser it needs only the shapes (search-shared imports nothing),
  // never the rules in search-core (the whole tarot deck) or lib/search (the database). The recent-searches shapes are the
  // one other import: that file imports only search-shared (tests/recent-searches-core.test.ts holds it to that).
  assert.deepEqual(importsOf("components/SiteSearch.tsx"), ["@/components/ui/Button", "@/components/ui/Field", "@/lib/edition", "@/lib/recent-searches-core", "@/lib/search-shared", "next/link", "next/navigation", "react"]);
  assert.deepEqual(importsOf("lib/search-shared.ts"), []);
});

test("every group but Your tools can be folded, and the menu starts with nothing folded", () => {
  for (const g of NAV_GROUPS) if (g.id !== "tools") assert.ok((NAV_FOLD_KEYS as readonly string[]).includes(g.id), g.id);
  assert.ok(!(NAV_FOLD_KEYS as readonly string[]).includes("tools"));
  assert.deepEqual(DEFAULT_NAV_FOLDED, []);
});

test("Your tools is one link to the home page, marked on every tool's pages", () => {
  assert.equal(TOOLS_LINK.href, "/");
  assert.equal(TOOLS_LINK.label, "Your tools");
  assert.equal(TOOLS_LINK.icon, undefined);
  for (const t of TOOL_ITEMS) assert.ok(TOOLS_LINK.also!.includes(t.href!), t.href);
  const nav = readFileSync(new URL("../components/nav/NavBody.tsx", import.meta.url), "utf8");
  assert.match(nav, /<NavGlyph id="tools" group className="h-5 w-5 shrink-0" \/>/, "its own bundle-of-tools drawing (owner's request, 2026-10-26)");
  assert.doesNotMatch(nav, /toolRow|visibleTools|Other tools \(/);
});

test("first-run and navigation branding use the app sigil, while admin markers use the pentacle", () => {
  const setup = readFileSync(new URL("../components/SetupForm.tsx", import.meta.url), "utf8");
  assert.match(setup, /<AppSigil className="h-16 w-16 mx-auto mb-3 text-tone-300" \/>/);
  assert.doesNotMatch(setup, /✦/);

  const header = readFileSync(new URL("../components/AppHeader.tsx", import.meta.url), "utf8");
  const nav = readFileSync(new URL("../components/nav/NavBody.tsx", import.meta.url), "utf8");
  const invites = readFileSync(new URL("../components/InviteCodes.tsx", import.meta.url), "utf8");
  assert.match(header, /<NavGlyph id="admin"/);
  assert.match(nav, /<NavGlyph id="admin"/);
  assert.match(invites, /<NavGlyph id="admin"/);
});

test("Recent folds like a group and sits right after Your writings", () => {
  assert.ok((NAV_FOLD_KEYS as readonly string[]).includes("recent"));
  assert.ok(!DEFAULT_NAV_FOLDED.includes("recent"));
  assert.deepEqual(toggleFold([], "recent"), ["recent"]);
  const body = readFileSync("components/nav/NavBody.tsx", "utf8");
  assert.match(body, /group\.id === "writing" && \(\s*<RecentPages/);
  assert.match(body, /open=\{isOpen\("recent"\)\}/);
});

test("the folded parts read from the account: null is the start, an empty text is nothing folded, unknown keys are dropped", () => {
  assert.deepEqual(parseNavFolded(null), []);
  assert.deepEqual(parseNavFolded(undefined), []);
  assert.deepEqual(parseNavFolded(""), []);
  // "tools" and "tools-rest" were the folds of the old list of tools; an account that still has them loses them quietly.
  assert.deepEqual(parseNavFolded("learn, tools,nonsense,learn,tools-rest,help"), ["learn", "help"]);
});

test("a list sent to be saved keeps only known parts, and anything but a list is refused", () => {
  assert.deepEqual(cleanNavFolded(["help", "writing", 3, "x", "tools"]), ["writing", "help"]);
  assert.deepEqual(cleanNavFolded([]), []);
  assert.equal(cleanNavFolded("learn"), null);
  assert.equal(cleanNavFolded(null), null);
});

test("folding and opening a part changes only that part and keeps the order", () => {
  assert.deepEqual(toggleFold(["learn"], "writing"), ["writing", "learn"]);
  assert.deepEqual(toggleFold(["writing", "learn"], "writing"), ["learn"]);
  assert.deepEqual(toggleFold([], "help"), ["help"]);
});
