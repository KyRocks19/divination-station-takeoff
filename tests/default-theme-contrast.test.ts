// The app's own colours (the default every person has until they pick a theme) against the same wider contrast set the
// ready-made themes are held to (open item T9b). The tokens are read from app/globals.css; the ones that point at a Tailwind
// colour (`var(--color-purple-600)`) are looked up in Tailwind's theme file and converted from oklch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SCREEN_CHECKS, blend, contrastRatio, type CheckColor } from "../lib/theme-lab-shared";

const root = path.join(__dirname, "..");
const globals = readFileSync(path.join(root, "app", "globals.css"), "utf8");
const tailwind = readFileSync(path.join(root, "node_modules", "tailwindcss", "theme.css"), "utf8");

/** oklch(L% C H) to #rrggbb, clipped to sRGB. */
export function oklchToHex(value: string): string {
  const m = value.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) throw new Error(`not an oklch colour: ${value}`);
  const L = Number(m[1]) / 100, C = Number(m[2]), h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  return "#" + lin.map((x) => Math.round(Math.min(1, Math.max(0, gamma(x))) * 255).toString(16).padStart(2, "0")).join("");
}

/** The default tokens, as hex: a direct hex value, or a `var(--color-x)` that resolves to one (in globals.css or Tailwind's palette). */
function defaultColors(): Record<string, string> {
  const block = globals.slice(0, globals.indexOf("}", globals.indexOf("@theme")));
  const raw = new Map<string, string>();
  for (const m of block.matchAll(/--(color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) raw.set(m[1], m[2].trim());
  const lookup = (name: string, depth = 0): string | undefined => {
    const v = raw.get(name) ?? tailwind.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
    if (!v || depth > 4) return undefined;
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    if (v.startsWith("oklch(")) return oklchToHex(v);
    const ref = v.match(/^var\(--(color-[a-z0-9-]+)\)$/);
    return ref ? lookup(ref[1], depth + 1) : undefined;
  };
  const out: Record<string, string> = {};
  for (const name of raw.keys()) {
    const hex = lookup(name);
    if (hex) out[name] = hex;
  }
  return out;
}

const resolve = (colors: Record<string, string>, c: CheckColor) =>
  typeof c === "object" ? blend(colors[c.token], colors[c.over], c.alpha) : c.startsWith("#") ? c : colors[c];

test("the oklch conversion matches known Tailwind colours", () => {
  // Tailwind's own sRGB fallbacks for these two (v4 docs): purple-700 #8200db, purple-600 #9810fa.
  assert.equal(oklchToHex("oklch(49.6% 0.265 301.924)"), "#8200db");
  assert.equal(oklchToHex("oklch(55.8% 0.288 302.321)"), "#9810fa");
});

test("the default colours pass every pair the screens use", () => {
  const colors = defaultColors();
  const failing: string[] = [];
  for (const c of SCREEN_CHECKS) {
    const fg = resolve(colors, c.fg), bg = resolve(colors, c.bg);
    if (!fg || !bg) continue; // a token the default leaves to the browser (none of the checked ones today)
    const r = contrastRatio(fg, bg);
    if (r < c.min) failing.push(`${c.label}: ${r.toFixed(2)} to 1 [${fg} on ${bg}]`);
  }
  assert.deepEqual(failing, []);
  for (const t of ["color-canvas", "color-surface", "color-ink", "color-tone-600", "color-tone-700"]) assert.ok(colors[t], `${t} resolves`);
});
