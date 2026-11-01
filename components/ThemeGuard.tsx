"use client";

import { useEffect } from "react";
import { LAB_OFF_PARAM, LAB_TOKENS, TEXT_MIX_VAR, THEME_STYLE_ID } from "@/lib/theme-lab-shared";

/**
 * The way out of a colour choice that made the app hard to read: a page opened with `?theme=off` shows the app's own
 * colours. The person's colours are put on <html> by the server (see app/layout.tsx); this takes them off in the
 * browser for that page only, and changes nothing that is saved.
 */
export default function ThemeGuard() {
  useEffect(() => {
    if (!window.location.search.includes(LAB_OFF_PARAM)) return;
    // The saved colours arrive as a style element (the page policy refuses a style attribute), so its sheet is switched off (the element stays, so React
    // finds the page as it left it); the properties the lab paints from script while it is open come off too.
    const sheet = (document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null)?.sheet;
    if (sheet) sheet.disabled = true;
    for (const t of LAB_TOKENS) document.documentElement.style.removeProperty(`--${t.name}`);
    document.documentElement.style.removeProperty(TEXT_MIX_VAR);
  }, []);
  return null;
}
