"use client";

import { useEffect, useState } from "react";
import { REVEAL_WAIT_KEY, parseRevealWait } from "@/lib/reveal-wait-core";

/**
 * The length the person chose for a reading's opening, in seconds, kept on this device (lib/reveal-wait-core.ts). It is null on the
 * first draw, so the page is the same on the server and in the browser, and the saved choice straight after. Storage that is blocked
 * just means the default.
 */
export function useRevealWait(): [number | null, (seconds: number) => void] {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(REVEAL_WAIT_KEY);
    } catch {
      /* storage blocked: the default */
    }
    setSeconds(parseRevealWait(saved));
  }, []);
  function choose(next: number) {
    setSeconds(next);
    try {
      window.localStorage.setItem(REVEAL_WAIT_KEY, String(next));
    } catch {
      /* not remembered */
    }
  }
  return [seconds, choose];
}
