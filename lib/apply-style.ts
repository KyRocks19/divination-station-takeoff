// Puts computed styles on an element from script, for the page policy that has no 'unsafe-inline' for styles (lib/csp.ts, open item S4).
// A browser refuses a style="..." attribute that arrives in HTML, but it does not refuse styles set from script through the element's
// `style` object, which is what this does. Pure apart from the element it is given, so it can be tested with a stand-in. No imports.

type StyleTarget = { style: { setProperty(name: string, value: string): void; removeProperty(name: string): string } };

/** What may be given as a value: text, a number (pixels unless the property is unitless), or nothing (the property is left off). */
export type StyleValue = string | number | null | undefined | false;
export type StyleMap = Record<string, StyleValue>;

// Numbers in these properties mean the number itself, not pixels (the same list React uses for its style objects, cut to what the app needs).
const UNITLESS = new Set([
  "opacity", "zIndex", "flex", "flexGrow", "flexShrink", "fontWeight", "lineHeight", "order", "zoom",
  "strokeWidth", "strokeOpacity", "fillOpacity", "aspectRatio", "scale",
]);

/** `borderLeft` becomes `border-left`; a custom property (`--speed`) stays as it is. */
export function cssName(property: string): string {
  if (property.startsWith("--")) return property;
  const name = property.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  return /^(webkit|moz|ms)-/.test(name) ? "-" + name : name;
}

/** The text to set for a value, or null when the property should be left off. */
export function cssValue(property: string, value: StyleValue): string | null {
  if (value === null || value === undefined || value === false || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value === 0 || UNITLESS.has(property) || property.startsWith("--") ? String(value) : `${value}px`;
  }
  const text = String(value);
  // A colour that comes from the person's or the app's data (a suit's blue, an element's amber, a position's colour) is drawn as that colour on a
  // dark page. On a light page the same mid-tone amber or green is too pale to read as text, so it is pulled toward the ink colour by --text-mix:
  // 0% unless the theme has a light page (lib/theme.ts sets it), so nothing changes on a dark one. Only a literal colour is mixed.
  if (property === "color" && /^(#[0-9a-fA-F]{3,8}|rgba?\()/.test(text)) {
    return `color-mix(in oklab, ${text} calc(100% - var(--text-mix, 0%)), var(--color-ink-strong))`;
  }
  return text;
}

const applied = new WeakMap<object, Set<string>>();

/** Sets the given styles on the element and takes off any this helper set earlier that are no longer given. */
export function applyStyle(el: StyleTarget, css: StyleMap): void {
  const before = applied.get(el) ?? new Set<string>();
  const now = new Set<string>();
  for (const [property, raw] of Object.entries(css)) {
    const value = cssValue(property, raw);
    if (value === null) continue;
    const name = cssName(property);
    el.style.setProperty(name, value);
    now.add(name);
  }
  for (const name of before) if (!now.has(name)) el.style.removeProperty(name);
  applied.set(el, now);
}

/**
 * A ref callback for a host element: `<div ref={styleRef({ width: "40%" })} />`. It runs after every render, so the styles follow the
 * values. Server-rendered HTML carries no style attribute, so the element is plain until the page loads in the browser, which is why
 * anything that sets the size of a box in a fixed way should be a class instead (and only values that come from the person's data go here).
 */
export function styleRef(css: StyleMap): (el: (Element & StyleTarget) | null) => void {
  return (el) => {
    if (el) applyStyle(el, css);
  };
}
