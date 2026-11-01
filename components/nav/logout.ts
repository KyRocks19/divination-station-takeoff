import { clearRecentPages } from "@/lib/recent-pages-store";
import { FEATHERED } from "@/lib/edition";
import { BUZZ_MS, EXIT_TRIGGERS_KEY, QUICK_EXIT_TARGET_KEY, SNAKE_PATH, WEATHER_URL, exitTriggers, quickExitTarget } from "@/lib/quick-exit-core";

/** Signs the person out. A full page load, so the signed-out page is drawn without the header and navigation. */
export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  clearRecentPages();
  window.location.assign("/login");
}

/**
 * The quick exit (decided 2026-10-22; the snake game from the owner's decisions of the same evening, docs/plan-feathered-edition.md 4.5): leaves at once
 * for something that is not the app, for someone who needs to hide what they are doing. It signs the person out and locks this browser on a small snake
 * game: every page shows the game until the account's password is typed as a high-score name (lib/quick-exit-core.ts). On Winged, this device can
 * choose a neutral weather search instead, as before; Feathered never goes online. The page is replaced in the history, so Back does not show the
 * person's writing, and the device's Recent list is cleared. It does not wait for the server: keepalive lets that request finish after the page is gone.
 * Text that was not saved yet is lost.
 *
 * `action` "stop" also stops the app afterwards, as "Stop and remove the drive" does (the server decides whether this browser may; if not, it is the
 * lock alone). The ways to set it off are in components/QuickExitTriggers.tsx. When this device keeps the buzz on and the phone allows it, the page
 * buzzes once and waits that long before leaving, since a phone stops buzzing for a page that has gone.
 */
let leaving = false;

export function quickExit(action: "pause" | "stop" = "pause") {
  // Two ways firing together (a tap that is also a shake) leave once. A page brought back from the browser's memory can leave again.
  if (leaving) return;
  leaving = true;
  window.setTimeout(() => (leaving = false), 3000);
  let stored: string | null = null;
  let triggers: string | null = null;
  try {
    stored = window.localStorage.getItem(QUICK_EXIT_TARGET_KEY);
    triggers = window.localStorage.getItem(EXIT_TRIGGERS_KEY);
  } catch {
    // A browser that keeps nothing goes to the game.
  }
  const target = quickExitTarget(stored, FEATHERED);
  const stop = action === "stop";
  try {
    void fetch(target === "snake" || stop ? "/api/auth/quick-exit" : "/api/auth/logout", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ back: window.location.pathname + window.location.search, ...(stop ? { stop: true } : {}) }),
    }).catch(() => {});
  } catch {
    // Leaving matters more than the sign-out.
  }
  clearRecentPages();
  let buzzed = false;
  try {
    buzzed = exitTriggers(triggers, true).buzz && typeof navigator.vibrate === "function" && navigator.vibrate(BUZZ_MS);
  } catch {
    // No buzz.
  }
  const go = () => window.location.replace(target === "snake" ? SNAKE_PATH : WEATHER_URL);
  if (buzzed) window.setTimeout(go, BUZZ_MS);
  else go();
}