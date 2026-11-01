// Limits on layouts. This file touches no database code, so screens that run in the browser can import it.

/**
 * The most positions one layout can have. A draw can never use more positions than its set has items (78 tarot
 * cards, 24 runes, 20 or 25 ogham staves, however many cards a deck holds), so this is only a guard against a mistake
 * that would freeze the page or fill the database. It is far above any real set.
 */
export const MAX_POSITIONS = 100000;
export const MAX_NAME_LENGTH = 120;
export const MAX_TEXT_LENGTH = 1000;

/** Positions of a board layout are in these units (the size a card is drawn at), so a person's placements mean the same everywhere. */
export const BOARD_CARD_W = 96;
export const BOARD_CARD_H = 168;
export const BOARD_MAX = 5000;
/** Positions snap to this step in the editor. */
export const BOARD_STEP = 2;
/** With the editor's grid on, a card moves a quarter of its own width across and a quarter of its height down. */
export const GRID_STEP_X = BOARD_CARD_W / 4;
export const GRID_STEP_Y = BOARD_CARD_H / 4;

/** Rounds a board coordinate to the nearest multiple of `step`, kept between 0 and the last step inside BOARD_MAX. */
export function snapToStep(n: number, step: number): number {
  const top = Math.floor(BOARD_MAX / step) * step;
  return Math.max(0, Math.min(top, Math.round(n / step) * step));
}

/** Splits a position name into at most two short lines so it fits over a card on a board. */
export function wrapLabel(text: string): string[] {
  const upper = text.toUpperCase();
  if (upper.length <= 14) return [upper];
  const words = upper.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > 14) {
      lines.push(line);
      line = w;
    } else line = line ? line + " " + w : w;
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(" ")];
}

export interface EditablePosition {
  name: string;
  prompt: string;
  /** #rrggbb, or "" for no colour. */
  color: string;
  /** Place on the board; null when the layout is a plain list. */
  x: number | null;
  y: number | null;
  rotation: number | null;
}

/** Lives here, not in the editor, because the server page calls it and a "use client" file's functions cannot be called from the server. */
export const blankPosition = (): EditablePosition => ({ name: "", prompt: "", color: "", x: null, y: null, rotation: null });

const HEX_COLOR =/^#[0-9a-fA-F]{6}$/;
/** A six-digit hex colour like #a855f7, or null for anything else. */
export function cleanColor(value: unknown): string | null {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim().toLowerCase() : null;
}
