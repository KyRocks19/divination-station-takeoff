// The colour lab on /design (see docs/design-system.md). This file touches no database code, so the pages that run
// in the browser can import it.

/** The tokens a person can change, in the order the lab lists them. `name` is the CSS variable without the dashes. */
export const LAB_TOKENS: { name: string; label: string; group: string }[] = [
  { name: "color-canvas", label: "Page background", group: "Surfaces" },
  { name: "color-surface", label: "Cards and panels", group: "Surfaces" },
  { name: "color-surface-sunken", label: "Panel inside a panel", group: "Surfaces" },
  { name: "color-field", label: "Inside of an input", group: "Surfaces" },
  { name: "color-ink", label: "Body text", group: "Text" },
  { name: "color-ink-strong", label: "Strong text", group: "Text" },
  { name: "color-ink-muted", label: "Muted text", group: "Text" },
  { name: "color-ink-soft", label: "Soft text", group: "Text" },
  { name: "color-ink-faint", label: "Faint text", group: "Text" },
  { name: "color-ink-ghost", label: "Ghost text", group: "Text" },
  { name: "color-heading", label: "Page titles", group: "Text" },
  { name: "color-bar", label: "Top bar background", group: "Top bar" },
  { name: "color-bar-ink", label: "Top bar text", group: "Top bar" },
  { name: "color-bar-active", label: "Top bar link you are on", group: "Top bar" },
  { name: "color-blush", label: "Light pink: main button and borders", group: "Pastel pink" },
  { name: "color-blush-soft", label: "Medium pink: main button under the pointer", group: "Pastel pink" },
  { name: "color-blush-deep", label: "Vivid pink: borders under the pointer", group: "Pastel pink" },
  { name: "color-focus", label: "Border of a box being typed in", group: "Pastel pink" },
  { name: "color-accent", label: "Purple button", group: "Purple accent" },
  { name: "color-accent-hover", label: "Purple button under the pointer", group: "Purple accent" },
  { name: "color-accent-ink", label: "Links and small actions", group: "Purple accent" },
  { name: "color-accent-ink-hover", label: "Links under the pointer", group: "Purple accent" },
  { name: "color-danger", label: "Error text", group: "Alerts" },
  { name: "color-danger-soft", label: "Lighter error or warning text", group: "Alerts" },
  { name: "color-danger-ink", label: "Delete under the pointer", group: "Alerts" },
  { name: "color-success", label: "Saved or good: text, borders and tints", group: "Alerts" },
  { name: "color-success-ink", label: "Lighter saved or good text", group: "Alerts" },
  { name: "color-warning", label: "Caution: text, borders and tints", group: "Alerts" },
  { name: "color-warning-ink", label: "Lighter caution text", group: "Alerts" },
  { name: "color-tone-100", label: "Tone 100: lightest tint", group: "Tones" },
  { name: "color-tone-200", label: "Tone 200: titles", group: "Tones" },
  { name: "color-tone-300", label: "Tone 300: headings and labels", group: "Tones" },
  { name: "color-tone-400", label: "Tone 400: small labels", group: "Tones" },
  { name: "color-tone-500", label: "Tone 500: dates and counts", group: "Tones" },
  { name: "color-tone-600", label: "Tone 600: chosen states", group: "Tones" },
  { name: "color-tone-700", label: "Tone 700: dark tint", group: "Tones" },
  { name: "color-tone-800", label: "Tone 800: darker tint", group: "Tones" },
  { name: "color-tone-900", label: "Tone 900: darkest tint", group: "Tones" },
];

/** The query that makes every page ignore a person's saved colours, in case a choice made the app hard to read. */
export const LAB_OFF_PARAM = "theme=off";

/** The id of the style element that carries a person's saved colours (app/layout.tsx), so `?theme=off` can take it off the page. */
export const THEME_STYLE_ID = "person-theme";

/** The custom property that pulls colours drawn as text toward the ink colour on a light page (lib/apply-style.ts); a theme with a light page sets it. */
export const TEXT_MIX_VAR = "--text-mix";
export const TEXT_MIX_LIGHT = "45%";

/** Where the lab used to keep colours, in the browser only. Kept so they can be offered once for saving to the profile. */
export const LAB_OLD_STORAGE_KEY = "theme-lab";

/** True for a plain six-digit hex colour, the only value the lab accepts. */
export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** The relative luminance of a six-digit hex colour (WCAG 2). */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** True when a six-digit hex colour is light enough to be the page of a light theme (its luminance is above one half). */
export function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.5;
}

/** The contrast ratio of two six-digit hex colours, from 1 (the same) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A six-digit hex colour with `alpha` (0 to 1) of it laid over another: what a panel drawn as `bg-tone-800/60` looks like on the page. */
export function blend(fg: string, over: string, alpha: number): string {
  const part = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (i: number) => Math.round(part(fg, i) * alpha + part(over, i) * (1 - alpha));
  return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Pairs of colours that are used together on screen, and the contrast each needs to be comfortable to read:
 * 4.5 to 1 for text, 3 to 1 for the border of a box being typed in. `fg` is the colour a person would change to fix
 * a pair that is too low (the lab offers to put it back).
 */
export const CONTRAST_CHECKS: { label: string; fg: string; bg: string; min: number }[] = [
  { label: "Body text on the page", fg: "color-ink", bg: "color-canvas", min: 4.5 },
  { label: "Strong text on cards", fg: "color-ink-strong", bg: "color-surface", min: 4.5 },
  { label: "Muted text on cards", fg: "color-ink-muted", bg: "color-surface", min: 4.5 },
  { label: "Faint text on cards", fg: "color-ink-faint", bg: "color-surface", min: 4.5 },
  { label: "Ghost text on cards", fg: "color-ink-ghost", bg: "color-surface", min: 4.5 },
  { label: "Soft text on cards", fg: "color-ink-soft", bg: "color-surface", min: 4.5 },
  { label: "Page titles on the page", fg: "color-heading", bg: "color-canvas", min: 4.5 },
  { label: "Tone 300 (headings and labels) on cards", fg: "color-tone-300", bg: "color-surface", min: 4.5 },
  { label: "Tone 400 (small labels) on cards", fg: "color-tone-400", bg: "color-surface", min: 4.5 },
  { label: "Tone 500 (dates and counts) on cards", fg: "color-tone-500", bg: "color-surface", min: 4.5 },
  { label: "Links on cards", fg: "color-accent-ink", bg: "color-surface", min: 4.5 },
  { label: "Error text on cards", fg: "color-danger", bg: "color-surface", min: 4.5 },
  { label: "Lighter error text on cards", fg: "color-danger-soft", bg: "color-surface", min: 4.5 },
  { label: "Text of the main button", fg: "color-canvas", bg: "color-blush", min: 4.5 },
  { label: "Text of the main button under the pointer", fg: "color-canvas", bg: "color-blush-soft", min: 4.5 },
  { label: "Text of the purple button", fg: "#ffffff", bg: "color-accent", min: 4.5 },
  { label: "Top bar text", fg: "color-bar-ink", bg: "color-bar", min: 4.5 },
  { label: "Top bar link you are on", fg: "color-bar-active", bg: "color-bar", min: 4.5 },
  { label: "Border of a box being typed in", fg: "color-focus", bg: "color-field", min: 3 },
];

/** A colour used in a check: a token name ("color-ink"), a plain hex colour, or a token laid over another at a share of its strength (`bg-tone-800/60`). */
export type CheckColor = string | { token: string; alpha: number; over: string };

/**
 * The wider set that a LIGHT theme is held to (open item T9). It comes from reading which text colours the screens draw on which backgrounds
 * (`text-tone-N`, `text-ink-*`, `text-success`, and so on, on the page, on cards and on panels inside cards) and the tinted and solid buttons
 * (`bg-tone-800/60 text-tone-200`, `bg-tone-700 text-white`). The dark themes were checked against CONTRAST_CHECKS only; these pairs are asserted for
 * the light one in tests/theme-palettes.test.ts, which also prints how the others do.
 */
const TEXT_ON_GROUNDS = [
  "color-ink", "color-ink-strong", "color-ink-muted", "color-ink-soft", "color-ink-faint", "color-ink-ghost", "color-heading",
  "color-tone-100", "color-tone-200", "color-tone-300", "color-tone-400", "color-tone-500", "color-tone-600",
  "color-accent-ink", "color-accent-ink-hover", "color-danger", "color-danger-soft", "color-danger-ink",
  "color-success", "color-success-ink", "color-warning", "color-warning-ink",
];
const GROUNDS = ["color-canvas", "color-surface", "color-surface-sunken"];
export const SCREEN_CHECKS: { label: string; fg: CheckColor; bg: CheckColor; min: number }[] = [
  ...GROUNDS.flatMap((g) => TEXT_ON_GROUNDS.map((t) => ({ label: `${t.replace("color-", "")} text on ${g.replace("color-", "")}`, fg: t, bg: g, min: 4.5 }))),
  { label: "Typing text on an input", fg: "color-ink", bg: "color-field", min: 4.5 },
  { label: "White text on the purple button", fg: "#ffffff", bg: "color-accent", min: 4.5 },
  { label: "White text on the purple button under the pointer", fg: "#ffffff", bg: "color-accent-hover", min: 4.5 },
  { label: "White text on a chosen button (tone 700)", fg: "#ffffff", bg: "color-tone-700", min: 4.5 },
  { label: "White text on a chosen button, a little see-through (tone 700 at 80%)", fg: "#ffffff", bg: { token: "color-tone-700", alpha: 0.8, over: "color-surface" }, min: 4.5 },
  { label: "White text on a small badge (tone 700 at 90%)", fg: "#ffffff", bg: { token: "color-tone-700", alpha: 0.9, over: "color-surface" }, min: 4.5 },
  { label: "Tone 200 text on a tinted panel (tone 800 at 60%)", fg: "color-tone-200", bg: { token: "color-tone-800", alpha: 0.6, over: "color-surface" }, min: 4.5 },
  { label: "Tone 200 text on a tinted panel under the pointer (tone 700 at 60%)", fg: "color-tone-200", bg: { token: "color-tone-700", alpha: 0.6, over: "color-surface" }, min: 4.5 },
  { label: "Tone 100 text on a tinted button (tone 700 at 60%)", fg: "color-tone-100", bg: { token: "color-tone-700", alpha: 0.6, over: "color-surface" }, min: 4.5 },
  { label: "Tone 100 text on a tinted button (tone 800 at 70%)", fg: "color-tone-100", bg: { token: "color-tone-800", alpha: 0.7, over: "color-surface" }, min: 4.5 },
  { label: "Tone 300 text on a faint tint (tone 900 at 30%)", fg: "color-tone-300", bg: { token: "color-tone-900", alpha: 0.3, over: "color-surface" }, min: 4.5 },
  { label: "Tone 300 text on a faint tint under the pointer (tone 800 at 30%)", fg: "color-tone-300", bg: { token: "color-tone-800", alpha: 0.3, over: "color-surface" }, min: 4.5 },
  { label: "Tone 200 text on a faint tint (tone 800 at 30%)", fg: "color-tone-200", bg: { token: "color-tone-800", alpha: 0.3, over: "color-surface" }, min: 4.5 },
  { label: "Tone 600 text on a tint (tone 900 at 50%)", fg: "color-tone-600", bg: { token: "color-tone-900", alpha: 0.5, over: "color-surface" }, min: 4.5 },
  { label: "Soft text on a tint (tone 900 at 40%)", fg: "color-ink-soft", bg: { token: "color-tone-900", alpha: 0.4, over: "color-surface" }, min: 4.5 },
  { label: "Typing border on an input", fg: "color-focus", bg: "color-field", min: 3 },
  { label: "Page-coloured text on a solid saved or good button", fg: "color-canvas", bg: "color-success", min: 4.5 },
  { label: "Page-coloured text on a solid saved or good button under the pointer", fg: "color-canvas", bg: "color-success-ink", min: 4.5 },
  // Text on the faint tints the screens lay behind panels, chips and notes (`bg-tone-900/30`, `bg-danger/10`), at the shares they use.
  ...[0.1, 0.2, 0.3, 0.4, 0.5].flatMap((a) =>
    ["color-ink-soft", "color-ink-muted", "color-ink-ghost", "color-tone-200", "color-tone-300", "color-tone-400", "color-tone-500", "color-tone-600"].map((t) => ({
      label: `${t.replace("color-", "")} text on a tint (tone 900 at ${a * 100}%)`,
      fg: t,
      bg: { token: "color-tone-900", alpha: a, over: "color-surface" },
      min: 4.5,
    }))
  ),
  { label: "Tone 200 text on a tint (tone 800 at 30%)", fg: "color-tone-200", bg: { token: "color-tone-800", alpha: 0.3, over: "color-surface" }, min: 4.5 },
  { label: "Tone 200 text on a tint (tone 700 at 30%)", fg: "color-tone-200", bg: { token: "color-tone-700", alpha: 0.3, over: "color-surface" }, min: 4.5 },
  // The error text on the tints the screens use for it: the strong red on 5% and 10%, the pointer colour on 5% and 10%, the lighter red on 10% and 25%.
  ...(
    [["color-danger", 0.05], ["color-danger", 0.1], ["color-danger-ink", 0.05], ["color-danger-ink", 0.1], ["color-danger-soft", 0.1], ["color-danger-soft", 0.25]] as const
  ).map(([t, a]) => ({
    label: `${t.replace("color-", "")} text on an error tint (danger at ${a * 100}%)`,
    fg: t as CheckColor,
    bg: { token: "color-danger", alpha: a, over: "color-surface" } as CheckColor,
    min: 4.5,
  })),
];

