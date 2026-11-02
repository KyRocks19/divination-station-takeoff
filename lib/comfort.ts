// "Reading comfort": the type and motion choices a person can make for themselves on this device (text size, spacing,
// a more readable font, less motion) and the layout choices kept with them (whether the header bar stays at the top, whether
// the side menu lies over the page or pushes it over). This file is plain data and plain functions with no browser or database code, so
// it can be tested and imported anywhere. The choices live in the browser's own storage, not in the account, so they apply
// on the sign-in page too and need no migration; app/layout.tsx puts them on <html> before the first paint.

export const COMFORT_KEY = "ds-comfort";

export type ComfortFont = "system" | "atkinson" | "lexend" | "opendyslexic";
export type ComfortSize = 100 | 115 | 130 | 150;
export type ComfortSpacing = "normal" | "roomy";
export type ComfortMotion = "system" | "less";
/** Whether the header bar stays at the top while the page scrolls ("sticky", the standard) or scrolls away with the page. */
export type ComfortHeader = "sticky" | "scrolls";
/** Whether the full side menu lies over the left of the page ("overlay", the standard since 2026-10-26) or pushes the page
 *  over to make room for itself ("push", as it did before). */
export type ComfortSidebar = "overlay" | "push";

export interface Comfort {
  font: ComfortFont;
  size: ComfortSize;
  spacing: ComfortSpacing;
  motion: ComfortMotion;
  header: ComfortHeader;
  sidebar: ComfortSidebar;
}

export const DEFAULT_COMFORT: Comfort = { font: "system", size: 100, spacing: "normal", motion: "system", header: "sticky", sidebar: "overlay" };

/** The choices shown under "Layout" in Settings; the rest are shown under "Reading comfort". Both are kept together. */
export const LAYOUT_FIELDS = ["header", "sidebar"] as const satisfies readonly (keyof Comfort)[];

export const FONT_CHOICES: { id: ComfortFont; label: string; note: string; family: string }[] = [
  { id: "system", label: "My device's own font", note: "What the app used before. It is the font you already read everything else in.", family: "system-ui, sans-serif" },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    note: "Made by the Braille Institute so that letters that look alike (I, l, 1, O, 0) are easy to tell apart. Made for low vision.",
    family: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  {
    id: "lexend",
    label: "Lexend",
    note: "Wider, evenly spaced letters, designed to make reading feel easier. Many people with dyslexia or ADHD like it.",
    family: '"Lexend Variable", system-ui, sans-serif',
  },
  {
    id: "opendyslexic",
    label: "OpenDyslexic",
    note: "Letters with heavier bottoms, made for people with dyslexia. Research on whether it helps is mixed; it helps some people a lot, so it is here to try.",
    family: '"OpenDyslexic", system-ui, sans-serif',
  },
];

export const SIZE_CHOICES: { id: ComfortSize; label: string }[] = [
  { id: 100, label: "Standard" },
  { id: 115, label: "Larger" },
  { id: 130, label: "Large" },
  { id: 150, label: "Largest" },
];

const FONTS: ComfortFont[] = ["system", "atkinson", "lexend", "opendyslexic"];
const SIZES: ComfortSize[] = [100, 115, 130, 150];

/** Reads what was stored, tolerating nothing, garbage, or a half-written value: anything unknown falls back to the default. */
export function parseComfort(raw: string | null | undefined): Comfort {
  if (!raw) return { ...DEFAULT_COMFORT };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_COMFORT };
  }
  if (!data || typeof data !== "object") return { ...DEFAULT_COMFORT };
  const d = data as Record<string, unknown>;
  return {
    font: FONTS.includes(d.font as ComfortFont) ? (d.font as ComfortFont) : DEFAULT_COMFORT.font,
    size: SIZES.includes(d.size as ComfortSize) ? (d.size as ComfortSize) : DEFAULT_COMFORT.size,
    spacing: d.spacing === "roomy" ? "roomy" : "normal",
    motion: d.motion === "less" ? "less" : "system",
    header: d.header === "scrolls" ? "scrolls" : "sticky",
    sidebar: d.sidebar === "push" ? "push" : "overlay",
  };
}

/** The attributes put on <html>; a choice that is the default has no attribute, so the page is exactly as it was. */
export function comfortAttributes(c: Comfort): Record<string, string> {
  const a: Record<string, string> = {};
  if (c.font !== "system") a["data-font"] = c.font;
  if (c.size !== 100) a["data-size"] = String(c.size);
  if (c.spacing === "roomy") a["data-spacing"] = "roomy";
  if (c.motion === "less") a["data-motion"] = "less";
  if (c.header === "scrolls") a["data-header"] = "scrolls";
  if (c.sidebar === "push") a["data-sidebar"] = "push";
  return a;
}

/** Every attribute this feature can set, so a change can clear the old ones first. */
export const COMFORT_ATTRIBUTES = ["data-font", "data-size", "data-spacing", "data-motion", "data-header", "data-sidebar"] as const;

/**
 * Runs in the page's <head> before anything is drawn, so there is no flash of the wrong font. It repeats the rules of
 * parseComfort and comfortAttributes in a few lines (a test runs both and checks they agree). Storage can throw in a
 * private window; then the page is simply the standard one.
 */
export const COMFORT_BOOT_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(COMFORT_KEY)})||"null");if(!c||typeof c!=="object")return;var d=document.documentElement;if(["atkinson","lexend","opendyslexic"].indexOf(c.font)>-1)d.setAttribute("data-font",c.font);if([115,130,150].indexOf(c.size)>-1)d.setAttribute("data-size",String(c.size));if(c.spacing==="roomy")d.setAttribute("data-spacing","roomy");if(c.motion==="less")d.setAttribute("data-motion","less");if(c.header==="scrolls")d.setAttribute("data-header","scrolls");if(c.sidebar==="push")d.setAttribute("data-sidebar","push");}catch(e){}})();`;
