// Shapes drawn from a seed, for two tools: tasseomancy (leaves left at the bottom of a cup) and ink blots (a blot of ink pressed on paper).
// The two were one tool until 2026-10-29 and still share this drawing code. The person writes what they see; the app never says what a shape is or means. A shape is drawn from a single whole number, its seed, so it can be drawn again exactly the same way
// from what is saved. This file touches no database code, so screens that run in the browser can import it.

import { getTea, type LeafForm, type TeaKind } from "./tea-core";

export type Vessel = "cup" | "ink";
export const VESSELS: Vessel[] = ["cup", "ink"];

export const VESSEL_WORDS: Record<Vessel, { label: string; hint: string; made: string }> = {
  cup: { label: "Tea leaves in a cup", hint: "Leaves scattered along the bottom and up the side of an empty cup.", made: "Cup" },
  ink: { label: "An ink blot", hint: "A blot pressed from a fold of paper, the same on both sides.", made: "Blot" },
};

export function isVessel(v: unknown): v is Vessel {
  return v === "cup" || v === "ink";
}

/** The seed range: a whole number from 0 to 2,147,483,647. */
export const MAX_SEED = 2147483647;

export function cleanSeed(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_SEED ? v : null;
}

/** A seed chosen by chance with the random method the person set in Settings. */
export function pickSeed(rng: () => number): number {
  return Math.min(MAX_SEED, Math.floor(rng() * (MAX_SEED + 1)));
}

/** A small, fixed random-number sequence from a seed (mulberry32), so the same seed always draws the same shape. */
function sequence(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A rounded, uneven blob around (cx, cy), as a closed smooth path. */
function blob(next: () => number, cx: number, cy: number, radius: number, points = 9): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const rad = radius * (0.55 + next() * 0.7);
    pts.push([cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad]);
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[points - 1], pts[0]);
  let d = `M${r1(start[0])} ${r1(start[1])}`;
  for (let i = 0; i < points; i++) {
    const m = mid(pts[i], pts[(i + 1) % points]);
    d += `Q${r1(pts[i][0])} ${r1(pts[i][1])} ${r1(m[0])} ${r1(m[1])}`;
  }
  return d + "Z";
}

/** A small pointed leaf at (cx, cy), turned by `angle`, as a closed path. */
function leaf(cx: number, cy: number, length: number, angle: number, plump: number): string {
  const dx = Math.cos(angle) * length;
  const dy = Math.sin(angle) * length;
  const nx = -Math.sin(angle) * length * plump;
  const ny = Math.cos(angle) * length * plump;
  const x0 = cx - dx / 2, y0 = cy - dy / 2, x1 = cx + dx / 2, y1 = cy + dy / 2;
  return `M${r1(x0)} ${r1(y0)}Q${r1(cx + nx)} ${r1(cy + ny)} ${r1(x1)} ${r1(y1)}Q${r1(cx - nx)} ${r1(cy - ny)} ${r1(x0)} ${r1(y0)}Z`;
}

/** The picture is drawn on a square 200 wide and 200 high. */
export const BLOT_SIZE = 200;

/**
 * The paths of the shape for a seed. For ink, a handful of blobs and drips are made on the left of a centre fold and mirrored to the right. For a cup, leaves
 * and a few clumps are scattered inside the cup's bowl (a circle about 90 across from the centre), most of them low and some climbing the side.
 * Every path is built from checked numbers only.
 */
export function blotPaths(seed: number, vessel: Vessel): string[] {
  const next = sequence(seed);
  const out: string[] = [];
  if (vessel === "ink") {
    const left: string[] = [];
    const blobs = 4 + Math.floor(next() * 4);
    for (let i = 0; i < blobs; i++) {
      const x = 100 - (6 + next() * 62);
      const y = 40 + next() * 120;
      left.push(blob(next, x, y, 10 + next() * 22));
    }
    // A thick middle stroke and a few thin drips.
    left.push(blob(next, 98, 100, 8 + next() * 10, 7));
    for (let i = 0; i < 3; i++) {
      const x = 100 - (10 + next() * 60);
      const y = 20 + next() * 160;
      left.push(blob(next, x, y, 2 + next() * 4, 6));
    }
    out.push(...left);
    return out;
  }
  const clumps = 2 + Math.floor(next() * 3);
  for (let c = 0; c < clumps; c++) {
    const angle = Math.PI / 2 + (next() - 0.5) * 3.2;
    const dist = next() * 52;
    const cx = 100 + Math.cos(angle) * dist;
    const cy = 100 + Math.sin(angle) * dist * 0.9 + 18;
    const n = 4 + Math.floor(next() * 7);
    for (let i = 0; i < n; i++) {
      out.push(leaf(cx + (next() - 0.5) * 22, cy + (next() - 0.5) * 16, 5 + next() * 9, next() * Math.PI * 2, 0.22 + next() * 0.2));
    }
  }
  const strays = 3 + Math.floor(next() * 6);
  for (let i = 0; i < strays; i++) {
    const angle = next() * Math.PI * 2;
    const dist = 20 + next() * 58;
    out.push(leaf(100 + Math.cos(angle) * dist, 100 + Math.sin(angle) * dist, 4 + next() * 6, next() * Math.PI * 2, 0.25));
  }
  return out;
}

/** One piece of what is left in a cup: a leaf, a needle, a petal or a speck of dust, and which of the tea's colours it takes. */
export interface LeafPiece {
  d: string;
  tone: "leaf" | "light" | "dust";
  /** 0.4 to 1: wet leaves are not all the same depth of colour. */
  opacity: number;
}

/** A number from a bell curve (mean 0, spread 1), made from two draws of the sequence. */
function bell(next: () => number): number {
  const u = Math.max(next(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
}

/** A torn, uneven piece: points around a stretched oval with their distance jittered, joined with straight edges. */
function torn(next: () => number, cx: number, cy: number, length: number, width: number, angle: number, corners: number): string {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let d = "";
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * Math.PI * 2 + (next() - 0.5) * 0.5;
    const k = 0.6 + next() * 0.55;
    const x = Math.cos(a) * (length / 2) * k;
    const y = Math.sin(a) * (width / 2) * k;
    d += `${i === 0 ? "M" : "L"}${r1(cx + x * cos - y * sin)} ${r1(cy + x * sin + y * cos)}`;
  }
  return d + "Z";
}

/** A thin, slightly bent sliver: a needle of green tea or rooibos, or a fine stem. */
function sliver(next: () => number, cx: number, cy: number, length: number, width: number, angle: number): string {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const bend = (next() - 0.5) * length * 0.35;
  const p = (x: number, y: number) => `${r1(cx + x * cos - y * sin)} ${r1(cy + x * sin + y * cos)}`;
  const h = length / 2, w = width / 2;
  return `M${p(-h, 0)}Q${p(0, bend - w)} ${p(h, 0)}Q${p(0, bend + w)} ${p(-h, 0)}Z`;
}

/** A leaf opened out in the water, with a slightly wavy edge (oolong). */
function openLeaf(next: () => number, cx: number, cy: number, length: number, angle: number): string {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const p = (x: number, y: number) => `${r1(cx + x * cos - y * sin)} ${r1(cy + x * sin + y * cos)}`;
  const h = length / 2, w = length * (0.22 + next() * 0.12);
  const steps = 5;
  let top = "", bottom = "";
  for (let i = 1; i < steps; i++) {
    const x = -h + (i / steps) * length;
    const y = Math.sin((i / steps) * Math.PI) * w * (0.85 + next() * 0.3);
    top += `L${p(x, -y)}`;
    bottom = `L${p(x, y * (0.85 + next() * 0.3))}` + bottom;
  }
  return `M${p(-h, 0)}${top}L${p(h, 0)}${bottom}Z`;
}

/** How many pieces each kind of leaf leaves behind, and how big they are, on the 200-wide picture. */
const FORMS: Record<LeafForm, { pieces: [number, number]; size: [number, number]; dust: [number, number] }> = {
  broken: { pieces: [80, 130], size: [3, 7.5], dust: [40, 80] },
  needle: { pieces: [70, 110], size: [5, 12], dust: [20, 40] },
  unfurled: { pieces: [14, 24], size: [9, 18], dust: [10, 20] },
  flake: { pieces: [45, 75], size: [3, 8], dust: [25, 45] },
  flower: { pieces: [40, 65], size: [4, 8], dust: [30, 50] },
  bud: { pieces: [30, 48], size: [6, 12], dust: [15, 30] },
};

/** The inside of the cup, seen from above: centre and radius of the bowl, on the 200-wide picture. */
export const TEA_CUP = { cx: 96, cy: 100, bowl: 80, rim: 88 };

/**
 * The leaves for a seed and a tea, drawn the way they are left in a cup that has been drunk down, swirled three times and turned out
 * on its saucer: a heap or two near the bottom (the centre, seen from above), trails thrown up the side by the swirl, single strays,
 * and fine dust. The pieces take the shape of the tea's own leaves (broken pieces, needles, opened leaves, flakes, petals, buds).
 * Every path is built from checked numbers only. Readings saved before teas could be chosen are drawn with blotPaths, unchanged.
 */
export function teaLeaves(seed: number, tea: TeaKind): LeafPiece[] {
  const next = sequence(seed);
  const t = getTea(tea);
  const f = FORMS[t.form];
  const { cx, cy, bowl } = TEA_CUP;
  const between = ([lo, hi]: [number, number]) => lo + next() * (hi - lo);
  const out: LeafPiece[] = [];

  // Keeps a point inside the bowl, pulling a stray back towards the centre.
  const inside = (x: number, y: number): [number, number] => {
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    const max = bowl - 6;
    return r <= max ? [x, y] : [cx + (dx / r) * max, cy + (dy / r) * max];
  };

  const piece = (x: number, y: number, scale = 1) => {
    const [px, py] = inside(x, y);
    const size = between(f.size) * scale;
    const angle = next() * Math.PI * 2;
    const opacity = 0.55 + next() * 0.45;
    switch (t.form) {
      case "broken": {
        // Mostly small torn pieces, with now and then a curled longer one or a bit of stem.
        if (next() < 0.12) out.push({ d: sliver(next, px, py, size * 1.8, 0.9, angle), tone: "leaf", opacity });
        else out.push({ d: torn(next, px, py, size * (1 + next()), size * (0.45 + next() * 0.4), angle, 5 + Math.floor(next() * 3)), tone: next() < 0.2 ? "light" : "leaf", opacity });
        break;
      }
      case "needle":
        out.push({ d: sliver(next, px, py, size, 0.9 + next() * 0.9, angle), tone: next() < 0.25 ? "light" : "leaf", opacity });
        break;
      case "unfurled":
        out.push({ d: openLeaf(next, px, py, size, angle), tone: next() < 0.35 ? "light" : "leaf", opacity: opacity * 0.9 });
        break;
      case "flake":
        out.push({ d: torn(next, px, py, size * (0.9 + next() * 0.6), size * (0.6 + next() * 0.4), angle, 4 + Math.floor(next() * 3)), tone: next() < 0.3 ? "light" : "leaf", opacity });
        break;
      case "flower":
        // Pale petals, with a yellow-brown flower centre among them now and then.
        if (next() < 0.25) out.push({ d: blob(next, px, py, size * 0.45, 7), tone: "leaf", opacity });
        else out.push({ d: sliver(next, px, py, size, size * 0.35, angle), tone: "light", opacity: 0.85 });
        break;
      case "bud":
        out.push({ d: sliver(next, px, py, size, size * (0.25 + next() * 0.15), angle), tone: next() < 0.5 ? "light" : "leaf", opacity: opacity * 0.85 });
        break;
    }
  };

  // One or two heaps near the bottom of the cup.
  const heaps = 1 + Math.floor(next() * 2);
  const total = Math.round(between(f.pieces));
  let left = total;
  for (let h = 0; h < heaps; h++) {
    const hx = cx + bell(next) * 16;
    const hy = cy + bell(next) * 14;
    const spread = 6 + next() * 9;
    const n = Math.round(total * (0.22 + next() * 0.12));
    left -= n;
    for (let i = 0; i < n; i++) piece(hx + bell(next) * spread, hy + bell(next) * spread * 0.85, 1.15);
  }

  // Trails up the side: the swirl throws leaves along an arc, thinning towards its end.
  const trails = 1 + Math.floor(next() * 3);
  for (let tr = 0; tr < trails && left > 0; tr++) {
    const start = next() * Math.PI * 2;
    const span = (0.5 + next() * 1.2) * (next() < 0.5 ? -1 : 1);
    const r0 = 18 + next() * 18;
    const r1x = 40 + next() * 32;
    const n = Math.min(left, Math.round(total * (0.1 + next() * 0.1)));
    left -= n;
    for (let i = 0; i < n; i++) {
      const k = Math.pow(next(), 0.8);
      const a = start + span * k;
      const r = r0 + (r1x - r0) * k + bell(next) * 3;
      piece(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 - k * 0.35);
    }
  }

  // Strays anywhere in the bowl, more of them low down.
  for (let i = 0; i < left; i++) {
    const a = next() * Math.PI * 2;
    const r = Math.sqrt(next()) * (bowl - 8);
    piece(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.8);
  }

  // Fine dust: tiny specks, a little thicker near the heaps.
  const dust = Math.round(between(f.dust));
  for (let i = 0; i < dust; i++) {
    const a = next() * Math.PI * 2;
    const r = Math.pow(next(), 0.7) * (bowl - 6);
    const [x, y] = inside(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    const size = 0.4 + next() * 0.8;
    out.push({ d: torn(next, x, y, size * 2, size * 1.6, next() * Math.PI, 4), tone: "dust", opacity: 0.4 + next() * 0.4 });
  }
  return out;
}

export function blotSummary(vessel: Vessel, tea: TeaKind | null = null): string {
  if (vessel === "cup" && tea) return `Tea leaves in a cup (${getTea(tea).label})`;
  return vessel === "cup" ? "Tea leaves in a cup" : "An ink blot";
}

export const BLOT_WORDS = {
  here: "The app presses a blot of ink from a fold of paper, the same on both sides, and you write what you see in it. It never says what a blot is or means. Look for as long as you like, and write whatever comes, even if it seems odd.",
  noMeaning: "The blot is made by chance with the random method chosen in Settings. Seeing a face, an animal or a place in it says something about how you look, not about the blot. No list of meanings is used here.",
  noSources: "This is this app's own design, so it has no sources page: it gives no meaning to any blot.",
};

/** What the app says about a tea-leaf reading (tasseomancy). */
export const TEA_READING_WORDS = {
  here: "Choose a tea, and the app draws the leaves left in your cup once it is drunk and turned out. You write what you see in them. It never says what a shape is or means. Look for as long as you like, and write whatever comes, even if it seems odd.",
  noMeaning: "The leaves are scattered by chance with the random method chosen in Settings. Seeing a face, an animal or a place in them says something about how you look, not about the leaves. No tradition's list of meanings is used here.",
  noSources: "Old handbooks of tea-cup reading give long lists of shapes and what they are said to mean. The app uses none of them, so this tool has no sources page of its own.",
};
