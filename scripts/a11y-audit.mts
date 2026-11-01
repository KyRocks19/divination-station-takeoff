// A deeper accessibility run than smoke-pages.mts, for the things a screen-reader or keyboard user meets: every axe rule at
// every impact (not only serious and critical), the page title, landmarks and headings, a Tab walk through the whole page
// (each stop must have a name and a visible focus ring, and focus must never fall back to <body>), contrast in all eight
// ready-made themes, reflow at 320 px, and WCAG 1.4.12 text spacing. Read-only apart from the first-run account.
//
// Start a local copy first (before-you-code, section 0), as for smoke-pages.mts. Then:
//   npx tsx scripts/a11y-audit.mts [--url http://localhost:3101] [--only /tarot,/runes] [--extra /readings/1,/cards/2]
//     [--skip themes,tab,reflow] [--json out.json]
// The signed-out pages (/login, /setup, /recover, /join) are checked in a second, signed-out browser.
// It cannot hear anything: NVDA itself is `npm run test:sr` on Windows (tests/a11y-sr/README.md).
import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { THEME_PALETTES } from "../lib/themes-data";
import { isLightColor, TEXT_MIX_LIGHT, TEXT_MIX_VAR } from "../lib/theme-lab-shared";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = (arg("--url") ?? "http://localhost:3101").replace(/\/$/, "");
const user = process.env.SMOKE_USER ?? "smoke-tester";
const password = process.env.SMOKE_PASSWORD ?? "smoke-tester-passphrase-1";
const skip = new Set((arg("--skip") ?? "").split(",").filter(Boolean));
const TAB_LIMIT = 250;

function staticPages(dir = "app", prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") out.push(prefix || "/");
      continue;
    }
    if (name === "api" || name.startsWith("[") || name.startsWith("_")) continue;
    out.push(...staticPages(full, name.startsWith("(") ? prefix : `${prefix}/${name}`));
  }
  return out.sort();
}

const SIGNED_OUT = ["/login", "/setup", "/recover", "/join"];

async function signIn(page: Page) {
  await page.goto(`${base}/setup`);
  if (page.url().includes("/setup")) {
    await page.getByLabel("Choose a username").fill(user);
    await page.getByLabel("Choose a password or a passphrase").fill(password);
    await page.getByLabel("The password again").fill(password);
    await page.getByRole("button", { name: "Set up" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/setup"), { timeout: 30_000 });
  } else {
    await page.goto(`${base}/login`);
    await page.getByLabel("Username").fill(user);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Enter" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  }
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: "I have read this" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/welcome"), { timeout: 30_000 });
  }
}

/** Opens a page and waits for it to go quiet; a page that keeps asking the server (polling) is checked once it has loaded. */
async function open(page: Page, p: string) {
  const res = await page.goto(`${base}${p}`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  return res;
}

type Finding = { page: string; check: string; detail: string };
const findings: Finding[] = [];
const add = (page: string, check: string, detail: string) => findings.push({ page, check, detail });
const titles = new Map<string, string[]>();

async function structure(page: Page, p: string) {
  const s = await page.evaluate(() => {
    const visible = (el: Element) => !!(el as HTMLElement).offsetParent || getComputedStyle(el).position === "fixed";
    const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((h) => Number(h.tagName[1]));
    const skips: string[] = [];
    for (let i = 1; i < heads.length; i++) if (heads[i] > heads[i - 1] + 1) skips.push(`h${heads[i - 1]}→h${heads[i]}`);
    const first = document.querySelector("a[href^='#']");
    return {
      title: document.title,
      mains: document.querySelectorAll("main,[role=main]").length,
      h1: heads.filter((h) => h === 1).length,
      firstHeading: Number(document.querySelector("main :is(h1,h2,h3,h4,h5,h6)")?.tagName[1] ?? 0),
      skips,
      lang: document.documentElement.lang,
      skipLink: first ? (first.textContent ?? "").trim() : "",
      skipTarget: first ? !!document.getElementById((first.getAttribute("href") ?? "#").slice(1)) : false,
      navsWithoutName: [...document.querySelectorAll("nav")].filter((n) => !n.getAttribute("aria-label") && !n.getAttribute("aria-labelledby")).length,
    };
  });
  if (!s.title.trim()) add(p, "title", "empty <title>");
  titles.set(s.title, [...(titles.get(s.title) ?? []), p]);
  if (s.mains !== 1) add(p, "landmark", `${s.mains} <main> elements`);
  if (s.h1 !== 1) add(p, "headings", `${s.h1} visible <h1>`);
  if (s.firstHeading > 1) add(p, "headings", `first heading in <main> is h${s.firstHeading}`);
  if (s.skips.length) add(p, "headings", `skipped level: ${[...new Set(s.skips)].join(", ")}`);
  if (!s.lang) add(p, "lang", "no lang on <html>");
  if (!/skip/i.test(s.skipLink) || !s.skipTarget) add(p, "skip link", `first in-page link is "${s.skipLink}" (target ${s.skipTarget ? "found" : "missing"})`);
  if (s.navsWithoutName) add(p, "landmark", `${s.navsWithoutName} <nav> without a label`);
}

async function axeAll(page: Page, p: string, label = "") {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  for (const v of axe.violations) {
    add(p, `axe ${v.id}${label} (${v.impact})`, `${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  }
}

/** Tab through the page from the top. Each stop needs an accessible name and a visible focus indicator. */
async function tabWalk(page: Page, p: string) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const seen = new Set<string>();
  const unnamed = new Set<string>();
  const noRing = new Set<string>();
  const hidden = new Set<string>();
  let bodyHits = 0;
  for (let i = 0; i < TAB_LIMIT; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const id = (e: Element): string => {
        const own = e.id ? `#${e.id}` : "";
        const cls = typeof (e as HTMLElement).className === "string" ? (e as HTMLElement).className.split(/\s+/).slice(0, 2).join(".") : "";
        return `${e.tagName.toLowerCase()}${own}${cls ? "." + cls : ""}`;
      };
      const path: string[] = [];
      for (let e: Element | null = el; e && e !== document.body && path.length < 4; e = e.parentElement) path.unshift(id(e));
      const cs = getComputedStyle(el);
      const ring =
        (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
        (cs.boxShadow && cs.boxShadow !== "none") ||
        el.matches(":focus-within") && !!el.closest("label") && getComputedStyle(el.closest("label")!).outlineStyle !== "none";
      const r = el.getBoundingClientRect();
      const offscreen = r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.left > innerWidth + 1;
      const inIframe = el.tagName === "IFRAME";
      return { key: path.join(" > "), ring, offscreen, inIframe, text: (el.innerText || el.getAttribute("aria-label") || "").slice(0, 40) };
    });
    if (!info) {
      bodyHits++;
      if (bodyHits > 1) break;
      continue;
    }
    if (seen.has(info.key + info.text)) break;
    seen.add(info.key + info.text);
    const snap = await page.locator(":focus").ariaSnapshot().catch(() => "");
    const firstLine = snap.split("\n")[0] ?? "";
    // A <summary> is named by its own text, which the snapshot shows as a text line.
    const isSummary = /^summary/.test(info.key.split(" > ").pop() ?? "") && info.text.trim() !== "";
    if (!isSummary && !/"[^"]+"/.test(firstLine) && !/- (textbox|combobox|slider|spinbutton|checkbox|radio|searchbox)\b/.test(firstLine) && !info.inIframe) {
      unnamed.add(`${info.key} [${firstLine.slice(0, 60)}]`);
    }
    if (/- (textbox|combobox|slider|spinbutton|checkbox|radio|searchbox)(\s|$|:)/.test(firstLine) && !/"[^"]+"/.test(firstLine)) {
      unnamed.add(`${info.key} [${firstLine.slice(0, 60)}]`);
    }
    if (!info.ring) noRing.add(`${info.key} "${info.text}"`);
    if (info.offscreen && !/skip/i.test(info.text)) hidden.add(`${info.key} "${info.text}"`);
  }
  for (const u of unnamed) add(p, "tab: no accessible name", u);
  for (const n of noRing) add(p, "tab: no visible focus ring", n);
  for (const h of hidden) add(p, "tab: focus on something not visible", h);
}

async function reflow(page: Page, p: string) {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(150);
  const s1 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (s1 > 1) add(p, "reflow 320px", `${s1}px sideways`);
  await page.addStyleTag({
    content: "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}",
  });
  await page.waitForTimeout(150);
  const s2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (s2 > 1) add(p, "text spacing 1.4.12 at 320px", `${s2}px sideways`);
  await page.setViewportSize({ width: 1280, height: 900 });
}

function themeRule(colors: Record<string, string>) {
  const decl = Object.entries(colors).map(([k, v]) => `--${k}:${v}!important`);
  if (colors["color-canvas"] && isLightColor(colors["color-canvas"])) decl.push(`${TEXT_MIX_VAR}:${TEXT_MIX_LIGHT}!important`);
  return `html:root{${decl.join(";")}}`;
}

async function themes(page: Page, p: string) {
  for (const t of THEME_PALETTES) {
    await open(page, p);
    await page.addStyleTag({ content: themeRule(t.colors) + "*{transition:none!important;animation:none!important}" });
    await page.waitForTimeout(100);
    const axe = await new AxeBuilder({ page }).withRules(["color-contrast", "link-in-text-block"]).analyze();
    for (const v of axe.violations) {
      add(p, `axe ${v.id} [theme ${t.id}]`, `${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} ${(n.any[0]?.message ?? "").replace(/\s+/g, " ").slice(0, 90)}`).join(" | ")}`);
    }
  }
}

async function check(page: Page, p: string) {
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(e.message.slice(0, 160));
  page.on("pageerror", onErr);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    const res = await open(page, p);
    if ((res?.status() ?? 0) === 404) return;
    // A page that sends the person elsewhere (/spreads to /layouts, /setup once set up) is checked where it lands.
    if (new URL(page.url()).pathname !== p.split("?")[0]) return;
    await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });
    await structure(page, p);
    await axeAll(page, p);
    if (!skip.has("tab")) await tabWalk(page, p);
    if (!skip.has("reflow")) await reflow(page, p);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, p);
    await axeAll(page, p, " @390");
    await page.setViewportSize({ width: 1280, height: 900 });
    if (!skip.has("themes")) await themes(page, p);
  } catch (err) {
    add(p, "did not finish", (err as Error).message.split("\n")[0].slice(0, 160));
  } finally {
    page.off("pageerror", onErr);
  }
  for (const e of new Set(errors)) add(p, "uncaught error", e);
}

async function main() {
  const only = arg("--only")?.split(",");
  const extra = arg("--extra")?.split(",") ?? [];
  const pages = [...(only ?? staticPages().filter((p) => !SIGNED_OUT.includes(p))), ...extra];
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM ?? "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  // bypassCSP lets the run add its own <style> (theme colours, text spacing); the app's policy refuses it otherwise.
  const context = await browser.newContext({ bypassCSP: true, reducedMotion: "reduce" });
  // tsx names inner functions with a __name helper that does not exist inside the page.
  await context.addInitScript("globalThis.__name = (f) => f");
  const page = await context.newPage();
  await signIn(page);
  for (const p of pages) {
    process.stderr.write(`${p}\n`);
    await check(page, p);
  }
  if (!only) {
    const out = await browser.newContext({ bypassCSP: true, reducedMotion: "reduce" });
    await out.addInitScript("globalThis.__name = (f) => f");
    const op = await out.newPage();
    for (const p of SIGNED_OUT) {
      process.stderr.write(`${p} (signed out)\n`);
      await check(op, p);
    }
  }
  await browser.close();
  for (const [t, ps] of titles) if (ps.length > 1) add(ps.join(", "), "title", `same title "${t}" on ${ps.length} pages`);

  process.stdout.write(`${pages.length} page(s) on ${base}\n`);
  if (!findings.length) process.stdout.write("No problems found.\n");
  for (const f of findings) process.stdout.write(`${f.page}\t${f.check}\t${f.detail}\n`);
  const json = arg("--json");
  if (json) writeFileSync(json, JSON.stringify(findings, null, 2));
  process.exitCode = findings.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
