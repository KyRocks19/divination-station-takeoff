"use client";

import { useEffect } from "react";
import { COMFORT_KEY, comfortAttributes, type Comfort } from "@/lib/comfort";

/**
 * Draws nothing. When the person's reading-comfort choices are kept in their account, the page is drawn with them on the server (app/layout.tsx);
 * this copies them to the device's local storage too, so the sign-in page, which has no account to read, follows the choices last used here.
 * Storage can throw in a private window; then the copy is simply not made.
 */
export default function ComfortMirror({ comfort }: { comfort: Comfort }) {
  const text = JSON.stringify(comfort);
  useEffect(() => {
    try {
      if (Object.keys(comfortAttributes(comfort)).length === 0) localStorage.removeItem(COMFORT_KEY);
      else localStorage.setItem(COMFORT_KEY, text);
    } catch {
      // Not stored: the account's choices still apply while signed in.
    }
    // `text` stands for `comfort`: the effect runs again only when a choice changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return null;
}
