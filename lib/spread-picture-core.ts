// A tarot spread as a picture the person can save and share (open item ED15b). This file works out what the picture holds and where: the size, the
// words, and the place of each card. It is pure (no database, no network, no canvas), so the browser and the tests use it; lib/spread-picture-draw.ts
// paints the plan onto a canvas in the person's own browser. Like the text version, the picture holds the title, the spread and the cards, and the
// question and the date only if the person ticks them. Notes and journal entries are never in it.

import { BOARD_CARD_H, BOARD_CARD_W } from "./layouts-shared";

export interface PictureCard {
  position: string;
  card_name: string;
  reversed: boolean;
  /** The picture file in /cards, when the card has one. */
  file: string | null;
  /** #rrggbb of the position, if the layout gave it one. */
  color?: string | null;
  /** Where a board layout put the card, in board units, and how far it is turned. */
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
}

export interface PictureReading {
  title: string | null;
  spread_name: string;
  question: string;
  created_at: string;
  cards: PictureCard[];
  /** Cards drawn to clarify, by the index of the card they clarify. */
  clarifiers: Record<number, { card_name: string; reversed: boolean }[]>;
}

export interface PictureChoices {
  question: boolean;
  date: boolean;
  /** Draw the card pictures. Off, each card is a plain box with its name. */
  art: boolean;
}

export const PICTURE_DEFAULTS: PictureChoices = { question: false, date: false, art: true };

/** The most cards a picture is made for; a longer draw would make a picture too tall to share. */
export const MAX_PICTURE_CARDS = 40;

/** The picture is drawn at twice the size of a board unit, so it is sharp on a phone screen. */
const SCALE = 2;
const W = BOARD_CARD_W * SCALE;
const H = BOARD_CARD_H * SCALE;
const SIDE = 64;
const TOP = 56;
const ABOVE = 20; // space between a position's name and the card
const LINE_ABOVE = 26;
const LINE_BELOW = 30;
const MIN_WIDTH = 900;
const GRID_COLUMNS = 5;
const GRID_GAP_X = 44; // board units
const GRID_GAP_Y = 120;

export interface TextLine {
  text: string;
  /** The middle of the line, and the line's baseline. */
  x: number;
  y: number;
}

export interface PlacedCard {
  index: number;
  /** The unturned card's top left corner, its size, and how far it is turned about its middle. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  reversed: boolean;
  file: string | null;
  color: string;
  name: string;
  /** The position's name in capitals, above the card (or under the card it lies on). */
  label: TextLine[];
  /** The card's name, "reversed" and any clarifiers, under the card. */
  below: (TextLine & { kind: "name" | "note" })[];
}

export interface PicturePlan {
  width: number;
  height: number;
  title: TextLine[];
  /** The spread's name and, if ticked, the date. */
  meta: TextLine | null;
  question: TextLine[];
  cards: PlacedCard[];
  /** The picture in words, for the alt text of a post and for a screen reader. */
  description: string;
}

export const DEFAULT_COLOR = "#a78bfa";
const HEX = /^#[0-9a-fA-F]{6}$/;

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Splits text into at most `maxLines` lines of about `maxChars` characters, breaking at spaces; the last line ends in "…" if text was left out. */
export function wrapWords(text: string, maxChars: number, maxLines: number): string[] {
  const words = oneLine(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    let w = words[i];
    if (w.length > maxChars) w = `${w.slice(0, maxChars - 1)}…`;
    if (line && `${line} ${w}`.length > maxChars) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = line ? `${line} ${w}` : w;
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    i = words.length;
  }
  if (i < words.length && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  }
  return lines;
}

const dateWords = (iso: string, locale?: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(locale ?? "en-US", { year: "numeric", month: "long", day: "numeric" });
};

/** Where each card sits, in board units: where the layout put it, or a plain grid of five across when it had no board. */
export function boardPlaces(cards: PictureCard[]): { x: number; y: number; rotation: number }[] {
  const onBoard = cards.length > 0 && cards.every((c) => typeof c.x === "number" && typeof c.y === "number");
  if (onBoard) return cards.map((c) => ({ x: c.x as number, y: c.y as number, rotation: c.rotation ?? 0 }));
  return cards.map((_, i) => ({
    x: (i % GRID_COLUMNS) * (BOARD_CARD_W + GRID_GAP_X),
    y: Math.floor(i / GRID_COLUMNS) * (BOARD_CARD_H + GRID_GAP_Y),
    rotation: 0,
  }));
}

/** The picture's plan, or null when there is nothing to draw or too much for one picture. Pure: the same reading and choices always give the same plan. */
export function planSpreadPicture(r: PictureReading, c: PictureChoices, locale?: string): PicturePlan | null {
  if (r.cards.length === 0 || r.cards.length > MAX_PICTURE_CARDS) return null;

  const places = boardPlaces(r.cards).map((p) => ({ x: p.x * SCALE, y: p.y * SCALE, rotation: p.rotation }));
  // The box a card fills once turned: a card turned a quarter way round swaps its width and height.
  const boxes = places.map((p) => {
    const sideways = ((((p.rotation % 180) + 180) % 180)) === 90;
    const bw = sideways ? H : W;
    const bh = sideways ? W : H;
    const cx = p.x + W / 2;
    const cy = p.y + H / 2;
    return { cx, cy, left: cx - bw / 2, right: cx + bw / 2, top: cy - bh / 2, bottom: cy + bh / 2 };
  });
  const minX = Math.min(...boxes.map((b) => b.left));
  const maxX = Math.max(...boxes.map((b) => b.right));
  const minY = Math.min(...boxes.map((b) => b.top));

  // The header: title, then the spread's name and date, then the question if ticked.
  const title = oneLine(r.title ?? "") || oneLine(r.spread_name) || "Reading";
  const titleLines = wrapWords(title, 34, 2);
  const metaParts: string[] = [];
  if (oneLine(r.spread_name) && oneLine(r.spread_name) !== title) metaParts.push(oneLine(r.spread_name));
  if (c.date) {
    const d = dateWords(r.created_at, locale);
    if (d) metaParts.push(d);
  }
  const questionLines = c.question && oneLine(r.question) ? wrapWords(`Question: ${oneLine(r.question)}`, 58, 3) : [];

  let y = TOP;
  const titlePlaced: TextLine[] = [];
  const width = Math.max(MIN_WIDTH, Math.ceil(maxX - minX) + 2 * SIDE);
  const mid = width / 2;
  titleLines.forEach((t) => {
    y += 52;
    titlePlaced.push({ text: t, x: mid, y });
  });
  let meta: TextLine | null = null;
  if (metaParts.length) {
    y += 42;
    meta = { text: metaParts.join(" · "), x: mid, y };
  }
  const questionPlaced: TextLine[] = [];
  questionLines.forEach((t) => {
    y += 38;
    questionPlaced.push({ text: t, x: mid, y });
  });
  y += 40;

  // Move the board under the header and in the middle; leave room above the first card for its position's name.
  const dx = mid - (minX + maxX) / 2;
  const posLines = r.cards.map((cd) => wrapWords(oneLine(cd.position).toUpperCase() || "CARD", 14, 2));
  const topLabels = Math.max(...posLines.map((l) => l.length)) * LINE_ABOVE + ABOVE;
  const dy = y + topLabels - minY;

  const placed: PlacedCard[] = [];
  /** Where the words under each card (and under any card lying on it) end, so a card lying on the same spot starts below them. */
  const blockEnd: number[] = [];
  const maxBottomOf = (lines: PlacedCard["below"], fallback: number) => (lines.length ? lines[lines.length - 1].y : fallback);
  let maxBottom = 0;
  r.cards.forEach((cd, i) => {
    const b = boxes[i];
    const cx = b.cx + dx;
    const cy = b.cy + dy;
    const top = b.top + dy;
    const bottom = b.bottom + dy;
    const color = cd.color && HEX.test(cd.color) ? cd.color.toLowerCase() : DEFAULT_COLOR;

    // A card lying across an earlier one shares that card's place: its words go under the earlier card's, so nothing is hidden.
    let host = -1;
    for (let j = 0; j < i; j++) if (Math.abs(boxes[j].cx - b.cx) < 24 && Math.abs(boxes[j].cy - b.cy) < 24) { host = j; break; }

    const nameLines = wrapWords(cd.card_name || "Empty card slot", 15, 2);
    const noteLines: string[] = [];
    if (cd.reversed) noteLines.push("reversed");
    for (const cl of r.clarifiers[i] ?? []) noteLines.push(...wrapWords(`clarifier: ${cl.card_name}${cl.reversed ? " (reversed)" : ""}`, 24, 1));

    let label: TextLine[];
    const below: PlacedCard["below"] = [];
    if (host < 0) {
      label = posLines[i].map((t, k) => ({ text: t, x: cx, y: top - ABOVE - (posLines[i].length - 1 - k) * LINE_ABOVE }));
      let ly = bottom + 36;
      for (const t of nameLines) { below.push({ text: t, x: cx, y: ly, kind: "name" }); ly += LINE_BELOW; }
      for (const t of noteLines) { below.push({ text: t, x: cx, y: ly, kind: "note" }); ly += LINE_BELOW - 4; }
      maxBottom = Math.max(maxBottom, ly);
    } else {
      const h = placed[host];
      const hostX = h.x + W / 2;
      let ly = blockEnd[host] + 12;
      label = [{ text: posLines[i].join(" "), x: hostX, y: ly }];
      ly += LINE_BELOW;
      for (const t of nameLines) { below.push({ text: t, x: hostX, y: ly, kind: "name" }); ly += LINE_BELOW; }
      for (const t of noteLines) { below.push({ text: t, x: hostX, y: ly, kind: "note" }); ly += LINE_BELOW - 4; }
      blockEnd[host] = ly;
      maxBottom = Math.max(maxBottom, ly);
    }
    blockEnd[i] = host < 0 ? maxBottomOf(below, bottom) : blockEnd[host];
    placed.push({
      index: i, x: cx - W / 2, y: cy - H / 2, w: W, h: H, rotation: places[i].rotation, reversed: cd.reversed, file: c.art ? cd.file : null,
      color, name: cd.card_name, label, below,
    });
    maxBottom = Math.max(maxBottom, bottom + 20);
  });

  const description =
    `${title}${metaParts.length ? ` (${metaParts.join(", ")})` : ""}. ` +
    r.cards
      .map((cd, i) => `${oneLine(cd.position) || `Card ${i + 1}`}: ${cd.card_name} (${cd.reversed ? "reversed" : "upright"})`)
      .join("; ") +
    ".";

  return {
    width: Math.ceil(width),
    height: Math.ceil(maxBottom + TOP),
    title: titlePlaced,
    meta,
    question: questionPlaced,
    cards: placed,
    description: c.question && oneLine(r.question) ? `${description} Question: ${oneLine(r.question)}` : description,
  };
}

/** A file name for the saved picture, from the title: lower case letters, digits and hyphens. */
export function pictureFileName(title: string | null, spreadName: string): string {
  const slug = oneLine(title || spreadName || "reading").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return `${slug || "reading"}-spread.png`;
}
