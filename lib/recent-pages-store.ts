// Where the Recent list is kept: this browser's storage, nowhere else. Every read and write is guarded, because storage
// can throw (a private window, blocked site data); the list is then simply empty. The list is kept per signed-in
// name, so two people using one browser do not see each other's pages, and it is cleared when a person logs out.

import { addRecent, parseRecent, type RecentPage } from "./recent-pages-core";

const KEY_PREFIX = "ds-recent:";
const OFF_KEY = "ds-recent-off";

/** Sent on window whenever the list or the on/off choice changes, so every copy of the menu redraws. */
export const RECENT_CHANGED = "ds-recent-changed";

function changed() {
  try {
    window.dispatchEvent(new Event(RECENT_CHANGED));
  } catch {
    // Nothing to tell.
  }
}

/** True unless the person switched the list off on this device. */
export function recentIsOn(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== "1";
  } catch {
    return true;
  }
}

/** Switches the list on or off for this device. Turning it off also deletes what was kept. */
export function setRecentOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, "1");
  } catch {
    // Not stored; the choice lasts until the page is closed.
  }
  if (!on) clearRecentPages();
  else changed();
}

export function loadRecent(username: string | undefined): RecentPage[] {
  if (!username) return [];
  try {
    return parseRecent(localStorage.getItem(KEY_PREFIX + username));
  } catch {
    return [];
  }
}

export function rememberPage(username: string | undefined, page: RecentPage) {
  if (!username || !recentIsOn()) return;
  try {
    localStorage.setItem(KEY_PREFIX + username, JSON.stringify(addRecent(loadRecent(username), page)));
  } catch {
    return;
  }
  changed();
}

/** Deletes the lists of everyone who used this browser. Called at log out and when an account is deleted. */
export function clearRecentPages() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // Nothing was stored, or storage is not available.
  }
  changed();
}
