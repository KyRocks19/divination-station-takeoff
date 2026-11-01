// The name and page of a piece of a ritual set, from its id, for lists of a person's own links. Pure: it imports only the
// tools' data files, never the database, so screens that run in the browser can use it.

import { TAROT_DECK } from "./cards";
import { RUNES } from "./runes-data";
import { STAVES } from "./ogham-data";
import { getFace } from "./dice-data";
import { SCRYING_SURFACE_LABELS, type ScryingSurface } from "./scrying-surfaces";
import { getHexagram } from "./iching-data";
import { getFigure } from "./geomancy-data";

export interface PieceLabel {
  name: string;
  href: string;
}

const SWING_NAMES: Record<string, string> = {
  "swing-line-0": "Pendulum: back and forth",
  "swing-line-90": "Pendulum: side to side",
  "swing-circle_cw": "Pendulum: circle clockwise",
  "swing-circle_ccw": "Pendulum: circle counter-clockwise",
  "swing-still": "Pendulum: still",
};

/** What a shared piece is called and where its page is, or null when the id is not a piece. */
export function symbolLabel(id: string): PieceLabel | null {
  const card = TAROT_DECK.find((c) => c.id === id);
  if (card) return { name: card.name, href: `/cards/${encodeURIComponent(card.id)}` };
  const rune = RUNES.find((r) => r.id === id);
  if (rune) return { name: `${rune.name} (rune)`, href: `/runes/set/${rune.id}` };
  const stave = STAVES.find((s) => s.id === id);
  if (stave) return { name: `${stave.name} (ogham)`, href: `/ogham/set/${stave.id}` };
  const face = getFace(id);
  if (face) return { name: `Dice: ${face.name}`, href: face.object === "coin" ? `/dice/set/coin/${face.face}` : `/dice/set/${face.object}/${face.face}` };
  const hexagram = getHexagram(id);
  if (hexagram) return { name: `${hexagram.pinyin} (I Ching, hexagram ${hexagram.n})`, href: `/iching/set/${hexagram.n}` };
  const figure = getFigure(id);
  if (figure) return { name: `${figure.latin} (geomancy)`, href: `/geomancy/set/${figure.id.slice(9)}` };
  if (SWING_NAMES[id]) return { name: SWING_NAMES[id], href: "/pendulum/swings" };
  const line = /^swing-line-(\d{1,3})$/.exec(id);
  if (line) return { name: `Pendulum: line at ${line[1]}°`, href: "/pendulum/swings" };
  const surface = /^scrying-(\w+)$/.exec(id);
  if (surface && surface[1] in SCRYING_SURFACE_LABELS) {
    return { name: `Scrying: ${SCRYING_SURFACE_LABELS[surface[1] as ScryingSurface].toLowerCase()}`, href: "/scrying/new" };
  }
  return null;
}

/** The page of one of the person's own oracle items. */
export function oracleItemHref(id: number): string {
  return `/oracle/cards/${id}`;
}
