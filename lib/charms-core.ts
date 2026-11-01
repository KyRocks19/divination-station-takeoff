// Charm casting: the charms of one of the person's own oracle sets (a set of the form "charms") are cast onto a square cloth, and each lands somewhere and
// shows one of its two sides. This file touches no database code, so screens that run in the browser can import it. The app gives no meaning for any place
// on the cloth or for either side: what a landing means is the person's own to write, and any tradition's reading of a cast is not claimed here.

export const CLOTH_SIZE = 1000;
export const MAX_CHARMS = 40;

export type Face = "up" | "down";

export interface Landing {
  /** Across, from 0 (left) to 1000 (right). */
  x: number;
  /** Down, from 0 (top) to 1000 (bottom). */
  y: number;
  face: Face;
}

/** Where each of `count` charms lands: a place anywhere on the cloth and one of its two sides, each equally likely, with the random method the person chose. */
export function castLandings(count: number, rng: () => number): Landing[] {
  const place = () => Math.min(CLOTH_SIZE, Math.floor(rng() * (CLOTH_SIZE + 1)));
  return Array.from({ length: count }, () => ({ x: place(), y: place(), face: rng() < 0.5 ? "up" : "down" }));
}

const third = (v: number, low: string, mid: string, high: string) => (v < 334 ? low : v < 667 ? mid : high);

/** Where a landing is, in words, for people who cannot see the picture: "near the middle", or "top, left". */
export function placeWords(x: number, y: number): string {
  const dx = x - CLOTH_SIZE / 2;
  const dy = y - CLOTH_SIZE / 2;
  if (Math.hypot(dx, dy) <= 150) return "near the middle";
  return `${third(y, "top", "middle", "bottom")}, ${third(x, "left", "middle", "right")}`;
}

export function faceWords(face: Face): string {
  return face === "up" ? "face up" : "face down";
}

export function castSummary(names: string[]): string {
  return names.length <= 4 ? names.join(", ") : `${names.slice(0, 4).join(", ")} and ${names.length - 4} more`;
}

export const CHARM_WORDS = {
  here: "Cast the charms of one of your own sets onto a cloth. The app picks where each lands and which side shows, by chance, with the random method chosen in Settings. It gives no meaning to any place or side: what a landing means is for you to write.",
  noSet: "You have no set made of charms yet. Make one in the Oracle Deck (choose the form Charms when you make a set), add the charms, and come back here.",
};
