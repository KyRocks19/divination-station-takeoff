import { RANK_PLURAL, SUIT_LABEL } from "./card-structure";

// A person's own words for a whole suit ("what Cups mean to me") or a whole number ("what Fives mean to me") are kept
// like their words for a single card: in card_customizations, with every version in card_meaning_revisions, under an id
// that cannot be a card's (for example 'group-suit-cups' or 'group-rank-5'). The text sits in the upright description.
// This file has no database code, so the browser can import it.

export type GroupKind = "suit" | "rank";

/** The four suits of the minor arcana. The major arcana is not a suit with a feel of its own, so it has no note. */
const SUITS = ["cups", "wands", "swords", "pentacles"] as const;

/** The longest note a person can keep for a suit or a number. */
export const MAX_GROUP_NOTE_LENGTH = 4000;

/** The id a suit's or a number's note is kept under, or null for a suit or rank that does not exist. */
export function groupNoteId(kind: GroupKind, key: string): string | null {
  if (kind === "suit" ? !(SUITS as readonly string[]).includes(key) : !(key in RANK_PLURAL)) return null;
  return `group-${kind}-${key}`;
}

/** What a group id stands for, with the words to show, or null when it is not a suit's or a number's id. */
export function parseGroupNoteId(id: string): { kind: GroupKind; key: string; label: string } | null {
  const m = /^group-(suit|rank)-([a-z0-9]+)$/.exec(id);
  if (!m) return null;
  const kind = m[1] as GroupKind;
  if (groupNoteId(kind, m[2]) === null) return null;
  const label = kind === "suit" ? SUIT_LABEL[m[2] as keyof typeof SUIT_LABEL] : RANK_PLURAL[m[2]];
  return { kind, key: m[2], label };
}
