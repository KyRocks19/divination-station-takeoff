// A concept's realm of its own (X4a, migration 101). Before it, a concept was only ever shown in the realm of its first
// archetype; now a concept may name its own, and when it names none it still takes its archetype's. No database code,
// so the encyclopedia, the archetype review and the person's own concepts can all use it in the browser.

import { REALMS } from "./archetypes-data";

/** The filter value for concepts that have no realm at all (no realm of their own and no archetype). */
export const NO_REALM = "none";

/** The realm a concept is shown under: its own when it has one, otherwise its archetype's; null when it has neither. */
export function effectiveRealm(own: string | null | undefined, inherited: string | null | undefined): string | null {
  const mine = own?.trim();
  if (mine) return mine;
  const theirs = inherited?.trim();
  return theirs ? theirs : null;
}

/** A shared tarot concept's own realm: one of the twelve shared realms, or null to take its first archetype's again. */
export function cleanSharedRealm(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value === "string" && (REALMS as readonly string[]).includes(value)) return { ok: true, value };
  return { ok: false, error: "That is not one of the realms" };
}

/** The realms to offer in a filter: the shared ones in their usual order first, then any others in A to Z order. */
export function realmChoices(realms: (string | null | undefined)[]): string[] {
  const used = new Set(realms.map((r) => r?.trim()).filter((r): r is string => !!r));
  const shared = (REALMS as readonly string[]).filter((r) => used.has(r));
  const others = [...used].filter((r) => !(REALMS as readonly string[]).includes(r)).sort((a, b) => a.localeCompare(b));
  return [...shared, ...others];
}

/** Whether a concept shown under `realm` passes the filter: "" lets everything through, NO_REALM only concepts without one. */
export function matchesRealm(realm: string | null, filter: string): boolean {
  if (!filter) return true;
  if (filter === NO_REALM) return realm === null;
  return realm === filter;
}
