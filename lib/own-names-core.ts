// A person's own name for a piece of a tool (open item T17; migration 076). It imports only the ogham letters, so the browser and
// the tests can use it. The app supplies no names: this is only where the person's own are kept. Today it is for the four sides
// of a knucklebone and the 25 ogham staves (a stave's own name is shown in the person's draws in place of its medieval name).

import { STAVES } from "./ogham-data";

const STAVE_IDS = new Set(STAVES.map((s) => s.id));

export const MAX_OWN_NAME = 60;

/** The pieces a person may name. One place, so another tool can be added with one line. */
export function canNamePiece(pieceId: string): boolean {
  return /^die-knucklebone-[a-d]$/.test(pieceId) || STAVE_IDS.has(pieceId);
}

/** A name as typed, with spaces tidied, or null when it is empty, too long or not text. */
export function cleanOwnName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= MAX_OWN_NAME ? name : null;
}

/** What to show for a piece: its plain label, and the person's own name when they have given one ("Side A: the dog"). */
export function withOwnName(label: string, own: string | null | undefined): string {
  return own ? `${label}: ${own}` : label;
}

/** The names as a lookup by piece id, from the rows the database gives. */
export function namesById(rows: { piece_id: string; name: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.piece_id, r.name]));
}
