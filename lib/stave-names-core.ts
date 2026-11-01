// What a stave is called on the person's screens: their own name for it when they have given one (kept with the other own
// names, lib/own-names.ts), otherwise the medieval name, and, when they choose, the later name that modern divination books
// give the five later letters. Pure: no database, so screens that run in the browser can use it.

import { getStave } from "./ogham-data";

export interface StaveTitle {
  /** The name to show first. */
  name: string;
  /** The medieval name, when the person's own name is shown in its place. */
  medieval: string | null;
  /** The later name and what it names ("Koad, the grove"), when asked for and the stave has one. */
  later: string | null;
}

/** How to title a stave, from the person's own name for it (or none) and whether they show the later names. */
export function staveTitle(staveId: string, own: string | null | undefined, showLater: boolean): StaveTitle {
  const stave = getStave(staveId);
  const medieval = stave?.name ?? staveId;
  const mine = own?.trim() || null;
  const later = showLater && stave?.laterName ? `${stave.laterName.name}, ${stave.laterName.means}` : null;
  return { name: mine ?? medieval, medieval: mine && mine !== medieval ? medieval : null, later };
}
