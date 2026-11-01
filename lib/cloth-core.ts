// Cloths: a cloth is a square the person throws items onto (runes, ogham staves, dice, coins, oracle items, tarot cards), with zones they name. An item belongs
// to the zone it landed in, whatever order it was thrown in (docs/plan-thrown-item-layouts.md, decided 2026-10-18). The app gives a zone no meaning:
// the names and notes are the person's own. This file has no imports, so the browser and the tests use it; lib/cloths.ts holds the SQL.

/** The cloth is a square this many units on a side. Places are whole numbers from 0 to CLOTH_SIZE, measured from the top left. The screens show percents. */
export const CLOTH_SIZE = 1000;
export const MAX_CLOTHS = 30;
export const MAX_ZONES = 20;
export const MAX_ZONE_POINTS = 24;
export const MAX_CLOTH_NAME = 60;
export const MAX_ZONE_NAME = 60;
export const MAX_ZONE_NOTE = 300;
export const MAX_CLOTH_DESCRIPTION = 600;

export type ZoneShape = "circle" | "ring" | "rectangle" | "half" | "wedge" | "freehand";
export const ZONE_SHAPES: ZoneShape[] = ["circle", "ring", "rectangle", "half", "wedge", "freehand"];
export const SHAPE_LABELS: Record<ZoneShape, string> = {
  circle: "Circle",
  ring: "Ring",
  rectangle: "Rectangle",
  half: "Half (one side of a line)",
  wedge: "Wedge (a slice of a circle)",
  freehand: "Freehand (your own corners)",
};

export type Edge = "left" | "right" | "top" | "bottom";
export const EDGES: Edge[] = ["left", "right", "top", "bottom"];

export type Geom =
  | { shape: "circle"; cx: number; cy: number; r: number }
  | { shape: "ring"; cx: number; cy: number; r: number; ri: number }
  | { shape: "rectangle"; x: number; y: number; w: number; h: number }
  | { shape: "half"; edge: Edge; at: number }
  | { shape: "wedge"; cx: number; cy: number; r: number; start: number; sweep: number }
  | { shape: "freehand"; points: [number, number][] };

export interface Zone {
  name: string;
  /** The person's own words about the zone, if any. */
  note: string | null;
  color: string | null;
  geom: Geom;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const place = (v: unknown): v is number => isInt(v, 0, CLOTH_SIZE);

/** A geometry as sent by the browser or read from the database, or the plain sentence saying what is wrong with it. */
export function cleanGeom(raw: unknown): { ok: true; geom: Geom } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "A zone needs a shape." };
  const g = raw as Record<string, unknown>;
  const bad = (error: string) => ({ ok: false as const, error });
  switch (g.shape) {
    case "circle":
      if (!place(g.cx) || !place(g.cy)) return bad("A circle's centre must be on the cloth.");
      if (!isInt(g.r, 1, CLOTH_SIZE)) return bad("A circle needs a radius greater than 0.");
      return { ok: true, geom: { shape: "circle", cx: g.cx, cy: g.cy, r: g.r } };
    case "ring":
      if (!place(g.cx) || !place(g.cy)) return bad("A ring's centre must be on the cloth.");
      if (!isInt(g.r, 2, CLOTH_SIZE) || !isInt(g.ri, 1, CLOTH_SIZE) || g.ri >= g.r) return bad("A ring needs an outer radius, and an inner radius that is smaller than it.");
      return { ok: true, geom: { shape: "ring", cx: g.cx, cy: g.cy, r: g.r, ri: g.ri } };
    case "rectangle":
      if (!place(g.x) || !place(g.y) || !isInt(g.w, 1, CLOTH_SIZE) || !isInt(g.h, 1, CLOTH_SIZE)) return bad("A rectangle needs a corner on the cloth, a width and a height greater than 0.");
      return { ok: true, geom: { shape: "rectangle", x: g.x, y: g.y, w: g.w, h: g.h } };
    case "half":
      if (typeof g.edge !== "string" || !EDGES.includes(g.edge as Edge)) return bad("A half needs a side: left, right, top or bottom.");
      if (!isInt(g.at, 1, CLOTH_SIZE - 1)) return bad("The line of a half must be inside the cloth.");
      return { ok: true, geom: { shape: "half", edge: g.edge as Edge, at: g.at } };
    case "wedge":
      if (!place(g.cx) || !place(g.cy)) return bad("A wedge's centre must be on the cloth.");
      if (!isInt(g.r, 1, CLOTH_SIZE)) return bad("A wedge needs a radius greater than 0.");
      if (!isInt(g.start, 0, 359)) return bad("A wedge's start angle is from 0 to 359 degrees.");
      if (!isInt(g.sweep, 1, 359)) return bad("A wedge's width is from 1 to 359 degrees.");
      return { ok: true, geom: { shape: "wedge", cx: g.cx, cy: g.cy, r: g.r, start: g.start, sweep: g.sweep } };
    case "freehand": {
      const pts = g.points;
      if (!Array.isArray(pts) || pts.length < 3 || pts.length > MAX_ZONE_POINTS) return bad(`A freehand zone needs 3 to ${MAX_ZONE_POINTS} corners.`);
      const points: [number, number][] = [];
      for (const p of pts) {
        if (!Array.isArray(p) || p.length !== 2 || !place(p[0]) || !place(p[1])) return bad("Each corner must be two places on the cloth.");
        points.push([p[0], p[1]]);
      }
      if (polygonArea(points) === 0) return bad("The corners of a freehand zone must not lie in a straight line.");
      return { ok: true, geom: { shape: "freehand", points } };
    }
    default:
      return bad("A zone needs a shape.");
  }
}

const tidy = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** One zone as typed. The name is required (it is how a placement is told apart); the note and colour are optional. */
export function cleanZone(raw: unknown): { ok: true; zone: Zone } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "A zone is missing." };
  const r = raw as Record<string, unknown>;
  const name = tidy(r.name, MAX_ZONE_NAME + 1);
  if (!name || name.length > MAX_ZONE_NAME) return { ok: false, error: `Give each zone a name of 1 to ${MAX_ZONE_NAME} characters.` };
  const note = typeof r.note === "string" ? r.note.replace(/\r\n?/g, "\n").trim() : "";
  if (note.length > MAX_ZONE_NOTE) return { ok: false, error: `A zone's note can be ${MAX_ZONE_NOTE} characters at most (${name}).` };
  const color = typeof r.color === "string" && r.color !== "" ? r.color : null;
  if (color !== null && !HEX.test(color)) return { ok: false, error: `The colour of ${name} must be a six-digit hex colour.` };
  const geom = cleanGeom(r.geom);
  if (!geom.ok) return { ok: false, error: `${name}: ${geom.error}` };
  return { ok: true, zone: { name, note: note || null, color: color ? color.toLowerCase() : null, geom: geom.geom } };
}

/** A cloth's name and description as typed, with its zones. Zone names must differ (ignoring capitals), so a placement names one zone. */
export function cleanCloth(raw: unknown): { ok: true; name: string; description: string | null; zones: Zone[] } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "The cloth could not be read." };
  const r = raw as Record<string, unknown>;
  const name = tidy(r.name, MAX_CLOTH_NAME + 1);
  if (!name || name.length > MAX_CLOTH_NAME) return { ok: false, error: `Give the cloth a name of 1 to ${MAX_CLOTH_NAME} characters.` };
  const description = typeof r.description === "string" ? r.description.replace(/\r\n?/g, "\n").trim() : "";
  if (description.length > MAX_CLOTH_DESCRIPTION) return { ok: false, error: `The description can be ${MAX_CLOTH_DESCRIPTION} characters at most.` };
  if (!Array.isArray(r.zones)) return { ok: false, error: "The zones must be a list." };
  if (r.zones.length > MAX_ZONES) return { ok: false, error: `A cloth can have ${MAX_ZONES} zones at most.` };
  const zones: Zone[] = [];
  const seen = new Set<string>();
  for (const z of r.zones) {
    const c = cleanZone(z);
    if (!c.ok) return c;
    const key = c.zone.name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `Two zones are called "${c.zone.name}". Give each zone its own name.` };
    seen.add(key);
    zones.push(c.zone);
  }
  return { ok: true, name, description: description || null, zones };
}

// ── Where a point falls ──────────────────────────────────────────────────────────────────────────────

/** The area of a polygon (the shoelace formula). 0 when the corners lie in a line. */
export function polygonArea(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function inPolygon(points: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The angle of a point from a centre in degrees, 0 straight up, turning clockwise (so 90 is to the right), from 0 up to 360. */
export function angleFrom(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Whether the point lies inside the geometry. The edge counts as inside. */
export function contains(g: Geom, x: number, y: number): boolean {
  switch (g.shape) {
    case "circle":
      return (x - g.cx) ** 2 + (y - g.cy) ** 2 <= g.r ** 2;
    case "ring": {
      const d2 = (x - g.cx) ** 2 + (y - g.cy) ** 2;
      return d2 <= g.r ** 2 && d2 >= g.ri ** 2;
    }
    case "rectangle":
      return x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
    case "half":
      if (x < 0 || x > CLOTH_SIZE || y < 0 || y > CLOTH_SIZE) return false;
      return g.edge === "left" ? x <= g.at : g.edge === "right" ? x >= CLOTH_SIZE - g.at : g.edge === "top" ? y <= g.at : y >= CLOTH_SIZE - g.at;
    case "wedge": {
      if ((x - g.cx) ** 2 + (y - g.cy) ** 2 > g.r ** 2) return false;
      if (x === g.cx && y === g.cy) return true;
      const a = (angleFrom(g.cx, g.cy, x, y) - g.start + 360) % 360;
      return a <= g.sweep;
    }
    case "freehand":
      return inPolygon(g.points, x, y);
  }
}

/** The area of a zone in square units, used to decide which of several zones that hold a point the item belongs to (the smallest). */
export function area(g: Geom): number {
  switch (g.shape) {
    case "circle":
      return Math.PI * g.r ** 2;
    case "ring":
      return Math.PI * (g.r ** 2 - g.ri ** 2);
    case "rectangle":
      return g.w * g.h;
    case "half":
      return g.at * CLOTH_SIZE;
    case "wedge":
      return (g.sweep / 360) * Math.PI * g.r ** 2;
    case "freehand":
      return polygonArea(g.points);
  }
}

/** Where a point is: on the cloth in a zone, on the cloth in no zone, or off the cloth. */
export type Landing = { kind: "zone"; index: number; zone: Zone; alsoIn: Zone[] } | { kind: "none" } | { kind: "off" };

export const onCloth = (x: number, y: number) => x >= 0 && x <= CLOTH_SIZE && y >= 0 && y <= CLOTH_SIZE;

/**
 * The zone a point belongs to. A zone may overlap another; the item belongs to the smallest zone that holds it (the first one listed when two
 * are the same size), and `alsoIn` names the others so the person is shown which. Off the cloth is its own answer.
 */
export function landing(zones: Zone[], x: number, y: number): Landing {
  if (!onCloth(x, y)) return { kind: "off" };
  const holding = zones.map((zone, index) => ({ zone, index, a: area(zone.geom) })).filter((z) => contains(z.zone.geom, x, y));
  if (holding.length === 0) return { kind: "none" };
  holding.sort((p, q) => p.a - q.a || p.index - q.index);
  const [first, ...rest] = holding;
  return { kind: "zone", index: first.index, zone: first.zone, alsoIn: rest.map((r) => r.zone) };
}

/** A plain sentence for where something landed, for the list and for a screen reader. */
export function landingWords(l: Landing): string {
  if (l.kind === "off") return "Off the cloth";
  if (l.kind === "none") return "On the cloth, in no zone";
  return l.alsoIn.length ? `In ${l.zone.name} (also inside ${l.alsoIn.map((z) => z.name).join(", ")})` : `In ${l.zone.name}`;
}

// ── Words for a zone, and the numbers the screens show ───────────────────────────────────────────────

/** Places are stored 0 to 1000 and shown as percents of the cloth, 0 to 100, with one decimal at most. */
export const toPercent = (units: number) => Math.round(units) / 10;
export const fromPercent = (percent: number) => Math.round(percent * 10);

/** One line saying what a zone is and where, in numbers a person can check. */
export function describeGeom(g: Geom): string {
  const p = (n: number) => `${toPercent(n)}%`;
  switch (g.shape) {
    case "circle":
      return `Circle with its centre ${p(g.cx)} across and ${p(g.cy)} down, and a radius of ${p(g.r)} of the cloth`;
    case "ring":
      return `Ring with its centre ${p(g.cx)} across and ${p(g.cy)} down, between radius ${p(g.ri)} and ${p(g.r)}`;
    case "rectangle":
      return `Rectangle with its top left corner ${p(g.x)} across and ${p(g.y)} down, ${p(g.w)} wide and ${p(g.h)} tall`;
    case "half":
      return `The ${g.edge} part of the cloth, up to a line ${p(g.at)} in from the ${g.edge}`;
    case "wedge":
      return `Wedge from a centre ${p(g.cx)} across and ${p(g.cy)} down, radius ${p(g.r)}, starting at ${g.start} degrees (0 is straight up, turning clockwise) and ${g.sweep} degrees wide`;
    case "freehand":
      return `Freehand zone with ${g.points.length} corners`;
  }
}

/** A starting geometry for a new zone of a shape, in the middle of the cloth, for the editor to change. */
export function defaultGeom(shape: ZoneShape): Geom {
  switch (shape) {
    case "circle":
      return { shape, cx: 500, cy: 500, r: 250 };
    case "ring":
      return { shape, cx: 500, cy: 500, r: 400, ri: 200 };
    case "rectangle":
      return { shape, x: 250, y: 250, w: 500, h: 500 };
    case "half":
      return { shape, edge: "left", at: 500 };
    case "wedge":
      return { shape, cx: 500, cy: 500, r: 450, start: 0, sweep: 90 };
    case "freehand":
      return { shape, points: [[200, 700], [500, 200], [800, 700]] };
  }
}

// ── Throwing ─────────────────────────────────────────────────────────────────────────────────────────

/** How far beyond the cloth an app-made throw can land, in units. An item that lands past the edge is off the cloth. */
export const THROW_MARGIN = 50;

/** A place for one thrown item, chosen by the person's random source (a function giving numbers from 0 up to but not including 1). */
export function randomPlace(rng: () => number): { x: number; y: number } {
  const span = CLOTH_SIZE + 2 * THROW_MARGIN;
  return { x: Math.floor(rng() * (span + 1)) - THROW_MARGIN, y: Math.floor(rng() * (span + 1)) - THROW_MARGIN };
}

// ── Counts across cloths (Patterns) ──────────────────────────────────────────────────────────────────

/** One row of the person's recorded placements, grouped: how many items of a tool landed where, on which cloth. */
export interface ClothCountRow {
  cloth_id: number | null;
  /** The cloth's name as it was recorded; it stays when the cloth is deleted. */
  cloth_name: string;
  /** The tool of the reading ("runes", "dice", ...), so a page can leave out tools the person is not showing. */
  kind: string;
  where_kind: "zone" | "none" | "off";
  zone_name: string | null;
  n: number;
}

export interface ClothTallyRow {
  label: string;
  n: number;
  /** How many different cloths the count comes from (for the combined table). */
  cloths: number;
}
export interface ClothTally {
  key: string;
  name: string;
  total: number;
  rows: ClothTallyRow[];
}

const whereLabel = (r: Pick<ClothCountRow, "where_kind" | "zone_name">) =>
  r.where_kind === "zone" ? (r.zone_name ?? "") : r.where_kind === "none" ? "On the cloth, in no zone" : "Off the cloth";

const keep = (rows: ClothCountRow[], shown: readonly string[] | null) => (shown === null ? rows : rows.filter((r) => shown.includes(r.kind)));

/** Plain counts for each cloth: where its items landed, most first. Tools the person is not showing are left out. A cloth with nothing left is not listed. */
export function tallyByCloth(rows: ClothCountRow[], shown: readonly string[] | null): ClothTally[] {
  const byCloth = new Map<string, { name: string; counts: Map<string, number> }>();
  for (const r of keep(rows, shown)) {
    const key = r.cloth_id === null ? `gone-${r.cloth_name}` : String(r.cloth_id);
    const c = byCloth.get(key) ?? { name: r.cloth_name, counts: new Map<string, number>() };
    const label = whereLabel(r);
    c.counts.set(label, (c.counts.get(label) ?? 0) + r.n);
    byCloth.set(key, c);
  }
  return [...byCloth.entries()]
    .map(([key, c]) => {
      const list = [...c.counts.entries()].map(([label, n]) => ({ label, n, cloths: 1 })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
      return { key, name: c.name, total: list.reduce((s, x) => s + x.n, 0), rows: list };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/**
 * The same counts added up over every cloth. A zone is matched by its name, ignoring capitals, so "Inner ring" on two cloths is one row. That is only
 * a matter of the words the person typed: the app does not say two zones with one name are the same thing, and the rows say how many cloths each comes from.
 */
export function tallyAcrossCloths(rows: ClothCountRow[], shown: readonly string[] | null): ClothTallyRow[] {
  const map = new Map<string, { label: string; n: number; cloths: Set<string> }>();
  for (const r of keep(rows, shown)) {
    const label = whereLabel(r);
    const key = r.where_kind === "zone" ? `z:${label.toLowerCase()}` : r.where_kind;
    const entry = map.get(key) ?? { label, n: 0, cloths: new Set<string>() };
    entry.n += r.n;
    entry.cloths.add(r.cloth_id === null ? `gone-${r.cloth_name}` : String(r.cloth_id));
    map.set(key, entry);
  }
  return [...map.values()].map((e) => ({ label: e.label, n: e.n, cloths: e.cloths.size })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

// ── How an item faced, and what is recorded ──────────────────────────────────────────────────────────

/** How an item lay: face up or face down. Asked only for tools whose items have a face that can be hidden (runes, ogham staves, oracle items, tarot cards, playing cards, charms; a tarot card keeps its upside-down mark as well, which is a different thing from how it lay). */
export const FACINGS = ["up", "down"] as const;
export type Facing = (typeof FACINGS)[number];
export const cleanFacing = (v: unknown): Facing | null => (typeof v === "string" && (FACINGS as readonly string[]).includes(v) ? (v as Facing) : null);
export const FACING_LABELS: Record<Facing, string> = { up: "face up", down: "face down" };

/** The tools whose items can be recorded on a cloth, and which of them have a facing the person records (dice and coins show their face already). */
export const CLOTH_KINDS = ["runes", "ogham", "dice", "oracle", "tarot", "playingcards", "charms"] as const;
export type ClothKind = (typeof CLOTH_KINDS)[number];
export const KIND_HAS_FACING: Record<ClothKind, boolean> = { runes: true, ogham: true, dice: false, oracle: true, tarot: true, playingcards: true, charms: true };
export const isClothKind = (k: unknown): k is ClothKind => typeof k === "string" && (CLOTH_KINDS as readonly string[]).includes(k);

export interface ItemRef {
  /** The item's place in the throw, from 0. */
  index: number;
  /** The item as it was named then: "Fehu", "d6 · 3", "Heads". */
  label: string;
}

/** What the person says about one item: where it landed (a place, a zone by name, or off the cloth) and how it faced. */
export interface PlacementInput {
  index: number;
  /** "zone" (named by `zone`), "none" (on the cloth, in no zone), "off" (off the cloth). */
  where: "zone" | "none" | "off";
  zone: string | null;
  x: number | null;
  y: number | null;
  facing: Facing | null;
  /** True when the app threw the item, false when the person recorded a real throw. */
  simulated: boolean;
}

/** The placements as sent, checked against the items that exist and the cloth's zones. Items not mentioned are left unplaced. */
export function cleanPlacements(raw: unknown, itemCount: number, zones: Zone[], hasFacing: boolean): { ok: true; list: PlacementInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "The placements must be a list." };
  if (raw.length > itemCount) return { ok: false, error: "There are more placements than items." };
  const names = new Set(zones.map((z) => z.name));
  const seen = new Set<number>();
  const list: PlacementInput[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return { ok: false, error: "A placement could not be read." };
    const r = p as Record<string, unknown>;
    if (!isInt(r.index, 0, Math.max(0, itemCount - 1)) || itemCount === 0 || seen.has(r.index)) return { ok: false, error: "A placement names an item that is not there, or names one twice." };
    seen.add(r.index);
    const where = r.where === "zone" || r.where === "none" || r.where === "off" ? r.where : null;
    if (!where) return { ok: false, error: "Say where each item landed." };
    let zone: string | null = null;
    if (where === "zone") {
      if (typeof r.zone !== "string" || !names.has(r.zone)) return { ok: false, error: "A placement names a zone that is not on this cloth." };
      zone = r.zone;
    }
    const x = r.x === null || r.x === undefined ? null : typeof r.x === "number" && Number.isInteger(r.x) && r.x >= -CLOTH_SIZE && r.x <= 2 * CLOTH_SIZE ? r.x : undefined;
    const y = r.y === null || r.y === undefined ? null : typeof r.y === "number" && Number.isInteger(r.y) && r.y >= -CLOTH_SIZE && r.y <= 2 * CLOTH_SIZE ? r.y : undefined;
    if (x === undefined || y === undefined || (x === null) !== (y === null)) return { ok: false, error: "A place needs both numbers, or neither." };
    list.push({ index: r.index, where, zone, x, y, facing: hasFacing ? cleanFacing(r.facing) : null, simulated: r.simulated === true });
  }
  return { ok: true, list };
}
