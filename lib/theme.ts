import { query } from "./db";
import { LAB_TOKENS, TEXT_MIX_LIGHT, TEXT_MIX_VAR, isHex, isLightColor } from "./theme-lab-shared";

export * from "./theme-lab-shared";

// A person's own colours (migration 031): `users.theme` holds a JSON object of token names to six-digit hex colours,
// or NULL for the app's own colours. Everything read from it or sent to it is checked again here: only the lab's own
// tokens and plain hex colours get through, so nothing else can reach the page's styles.

/** Keeps only the lab's tokens that have a six-digit hex colour. Anything else is dropped. */
export function cleanTheme(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const t of LAB_TOKENS) {
    const v = (raw as Record<string, unknown>)[t.name];
    if (isHex(v)) out[t.name] = v.toLowerCase();
  }
  return out;
}

/** Reads the saved text back into a theme, or null when there is none (or it cannot be read). */
export function parseTheme(text: string | null | undefined): Record<string, string> | null {
  if (!text) return null;
  try {
    const theme = cleanTheme(JSON.parse(text));
    return Object.keys(theme).length > 0 ? theme : null;
  } catch {
    return null;
  }
}

/**
 * The person's colours as one CSS rule, for a <style> element that carries the page's nonce (app/layout.tsx): a custom property for each
 * colour in the theme, or null when there is none. The page policy refuses inline style attributes (lib/csp.ts), so this is not put on
 * <html> as an attribute any more. `html:root` is more specific than the `:root` rule the app's own colours come in, so these win wherever
 * the element sits in the page. Only the lab's token names and six-digit hex colours get through cleanTheme, so nothing else can end up in the rule.
 */
export function themeCss(theme: Record<string, string> | null | undefined): string | null {
  if (!theme) return null;
  const clean = cleanTheme(theme);
  const declarations = Object.entries(clean).map(([name, value]) => `--${name}:${value}`);
  // A theme with a light page (the ready-made Daylight, or colours a person chose) also tells the screens to pull the suit, element and position colours they
  // draw as text toward the ink colour (lib/apply-style.ts); a dark page leaves them as they are.
  const canvas = clean["color-canvas"];
  if (declarations.length > 0 && canvas && isLightColor(canvas)) declarations.push(`${TEXT_MIX_VAR}:${TEXT_MIX_LIGHT}`);
  return declarations.length > 0 ? `html:root{${declarations.join(";")}}` : null;
}

/** Saves a person's theme. An empty or null theme puts the app's own colours back. */
export async function saveTheme(userId: number, theme: Record<string, string> | null): Promise<void> {
  const clean = theme ? cleanTheme(theme) : {};
  await query("UPDATE users SET theme = $1 WHERE id = $2", [
    Object.keys(clean).length > 0 ? JSON.stringify(clean) : null,
    userId,
  ]);
}
