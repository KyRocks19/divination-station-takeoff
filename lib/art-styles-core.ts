// The picture-maker's saved style notes (open item P1; migration 078). The words are the person's own; they only describe how a picture looks.
// No database code, so the browser and the tests use it.

import { MAX_STYLE_LENGTH } from "./art-maker";

export const MAX_ART_STYLES = 20;
export const MAX_ART_STYLE_NAME = 40;

/** A style note as typed: spaces tidied, at most MAX_STYLE_LENGTH characters, or null when it is empty or not text. Too long is refused, not cut. */
export function cleanStyleText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length > MAX_STYLE_LENGTH) return undefined;
  return text === "" ? null : text;
}

/** The name of a saved style as typed, or null when it is empty, too long or not text. */
export function cleanStyleName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= MAX_ART_STYLE_NAME ? name : null;
}

export interface SavedStyle {
  id: number;
  name: string;
  text: string;
}

/** Adds a saved style's words to a style note the way a preset is added: not twice, and cut at the limit. */
export function addToNote(note: string, text: string): string {
  if (note.toLowerCase().includes(text.toLowerCase())) return note;
  return [...note.split(",").map((p) => p.trim()).filter(Boolean), text].join(", ").slice(0, MAX_STYLE_LENGTH);
}
