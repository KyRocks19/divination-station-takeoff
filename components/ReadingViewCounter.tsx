"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readingFromPath } from "@/lib/calendar-core";

/** How long a second opening of the same reading in the same tab counts as the same visit. */
const SAME_VISIT_MS = 30 * 60_000;

/**
 * Counts each time the person opens one of their readings, so the calendar can show the reading of a day they went back to most (lib/calendar.ts).
 * It sits once in the root layout, for a signed-in person, and draws nothing. A reload or coming back within half an hour in the same tab is not
 * counted again. Only the count is kept: not when, and not from where.
 */
export default function ReadingViewCounter() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !readingFromPath(pathname)) return;
    const key = `ds-viewed:${pathname}`;
    try {
      const last = Number(sessionStorage.getItem(key));
      if (last && Date.now() - last < SAME_VISIT_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // No session storage (a private window may refuse it): count the visit anyway.
    }
    void fetch("/api/calendar/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: pathname }), keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}
