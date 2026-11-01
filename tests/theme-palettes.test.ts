// Checks on the ready-made colour themes: every colour is a token the lab knows, the lab's contrast pairs hold for each theme, and the light theme (Daylight,
// open item T9) also passes the wider set of pairs the screens use. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { THEME_PALETTES } from "../lib/themes-data";
import { CONTRAST_CHECKS, LAB_TOKENS, SCREEN_CHECKS, blend, contrastRatio, isHex, type CheckColor } from "../lib/theme-lab-shared";
import { cleanTheme, themeCss } from "../lib/theme";
import { cssValue } from "../lib/apply-style";

// The app's own value of each colour token, for the tokens a theme leaves out (read from the stylesheet's @theme block; a token defined in terms of another is skipped).
const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");
const DEFAULTS: Record<string, string> = {};
for (const m of css.slice(0, css.indexOf("}")).matchAll(/--(color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) DEFAULTS[m[1]] = m[2].toLowerCase();

const valueOf = (colors: Record<string, string>, token: string) => colors[token] ?? DEFAULTS[token];

function resolve(colors: Record<string, string>, c: CheckColor): string {
  if (typeof c === "object") return blend(valueOf(colors, c.token), valueOf(colors, c.over), c.alpha);
  return c.startsWith("#") ? c : valueOf(colors, c);
}

function failures(colors: Record<string, string>, checks: { label: string; fg: CheckColor; bg: CheckColor; min: number }[]) {
  const out: string[] = [];
  for (const c of checks) {
    const fg = resolve(colors, c.fg);
    const bg = resolve(colors, c.bg);
    if (!fg || !bg) {
      out.push(`${c.label}: a colour is missing`);
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    if (ratio < c.min) out.push(`${c.label}: ${ratio.toFixed(2)} to 1 (needs ${c.min}) [${fg} on ${bg}]`);
  }
  return out;
}

test("every palette has a unique id and name and only colours the lab knows, each a six-digit hex colour", () => {
  const known = new Set(LAB_TOKENS.map((t) => t.name));
  assert.equal(new Set(THEME_PALETTES.map((p) => p.id)).size, THEME_PALETTES.length);
  assert.equal(new Set(THEME_PALETTES.map((p) => p.name)).size, THEME_PALETTES.length);
  for (const p of THEME_PALETTES) {
    for (const [k, v] of Object.entries(p.colors)) {
      assert.ok(known.has(k), `${p.id}: ${k} is not a lab colour`);
      assert.ok(isHex(v), `${p.id}: ${k} is not a six-digit hex colour`);
    }
  }
});

test("a saved palette survives the check the server puts every theme through", () => {
  for (const p of THEME_PALETTES) {
    assert.equal(Object.keys(cleanTheme(p.colors)).length, Object.keys(p.colors).length, p.id);
    assert.ok(themeCss(p.colors)?.startsWith("html:root{"), p.id);
  }
});

test("each theme passes the lab's own contrast pairs", () => {
  for (const p of THEME_PALETTES) assert.deepEqual(failures(p.colors, CONTRAST_CHECKS), [], p.id);
});

test("the light theme exists, is a choice among the others, and is not the app's default", () => {
  const light = THEME_PALETTES.find((p) => p.id === "daylight");
  assert.ok(light, "Daylight is listed");
  assert.ok(THEME_PALETTES.length >= 8);
  // A light canvas, so it really is light; and it sets the alert colours the dark default makes for dark panels.
  assert.ok(contrastRatio(light!.colors["color-canvas"], "#000000") > 15);
  for (const t of ["color-success", "color-success-ink", "color-warning", "color-warning-ink"]) assert.ok(light!.colors[t], `${t} is set`);
  // The default is what a person with no saved theme has: nothing in the code picks Daylight for anyone.
  const sources = ["app/layout.tsx", "lib/theme.ts", "proxy.ts"].map((f) => readFileSync(path.join(__dirname, "..", f), "utf8")).join("\n");
  assert.doesNotMatch(sources, /["']daylight["']/);
  assert.doesNotMatch(sources, /prefers-color-scheme/);
});

test("the light theme passes every pair the screens use (text on the page, cards and panels, buttons, tints, alerts)", () => {
  const light = THEME_PALETTES.find((p) => p.id === "daylight")!;
  assert.deepEqual(failures(light.colors, SCREEN_CHECKS), []);
});

test("only a theme with a light page switches on the pulling of data colours toward the ink colour", () => {
  const light = themeCss(THEME_PALETTES.find((p) => p.id === "daylight")!.colors)!;
  assert.match(light, /--text-mix:45%/);
  for (const p of THEME_PALETTES.filter((q) => q.id !== "daylight")) assert.doesNotMatch(themeCss(p.colors)!, /--text-mix/, p.id);
  // A person's own light page counts too; a theme with no canvas colour does not.
  assert.match(themeCss({ "color-canvas": "#ffffff" })!, /--text-mix:45%/);
  assert.doesNotMatch(themeCss({ "color-ink": "#ffffff" })!, /--text-mix/);
});

test("a colour drawn as text goes through the text mix, and nothing else does", () => {
  assert.match(cssValue("color", "#f59e0b")!, /^color-mix\(in oklab, #f59e0b calc\(100% - var\(--text-mix, 0%\)\), var\(--color-ink-strong\)\)$/);
  assert.match(cssValue("color", "rgba(1,2,3,0.5)")!, /^color-mix\(/);
  assert.equal(cssValue("color", "var(--color-ink)"), "var(--color-ink)");
  assert.equal(cssValue("color", "red"), "red");
  assert.equal(cssValue("backgroundColor", "#f59e0b"), "#f59e0b");
  assert.equal(cssValue("borderColor", "#f59e0b"), "#f59e0b");
});

test("the boards, graph and tiles no longer draw text in a colour made for a dark page", () => {
  const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
  const banned = ["#e2e8f0", "#9ca3af", "#f43f5e", "#581c87", "#cbd5e1", "#fda4af", "#e9d5ff", "#0d0d1e"];
  for (const f of [
    "components/SpreadSVG.tsx", "components/LayoutBoard.tsx", "components/CelticCrossViewBox.tsx", "components/encyclopedia/CardWeb.tsx",
    "components/encyclopedia/ConceptGraph.tsx", "components/layouts/BoardEditor.tsx", "components/encyclopedia/ZodiacWheel.tsx", "components/CardStructure.tsx",
  ]) {
    const src = read(f).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    for (const c of banned) assert.ok(!src.toLowerCase().includes(c) || (f.endsWith("ConceptGraph.tsx") && /\|\| "#/.test(src)), `${f} still has ${c}`);
  }
});

test("rendered Markdown takes its colours from the tokens, for every role the typography plugin names", () => {
  const roles = ["body", "headings", "lead", "links", "bold", "counters", "bullets", "hr", "quotes", "quote-borders", "captions", "kbd", "kbd-shadows", "code", "pre-code", "pre-bg", "th-borders", "td-borders"];
  for (const r of roles) assert.match(css, new RegExp(`--tw-prose-invert-${r}:\\s*var\\(--color-`), r);
});

test("?theme=off switches off the style element the server writes, by the id both sides use", () => {
  const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.match(read("app/layout.tsx"), /<style id=\{THEME_STYLE_ID\}/);
  const guard = read("components/ThemeGuard.tsx");
  assert.match(guard, /getElementById\(THEME_STYLE_ID\)/);
  assert.match(guard, /sheet\.disabled = true/);
  assert.match(guard, /removeProperty\(TEXT_MIX_VAR\)/);
});

test("every theme, dark or light, passes every pair the screens use (T9b, 2026-10-22)", () => {
  for (const p of THEME_PALETTES) assert.deepEqual(failures(p.colors, SCREEN_CHECKS), [], p.id);
});
