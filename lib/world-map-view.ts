// What part of the world map is in view, and how a pinch, a drag, a wheel turn or a button changes it (open item T10). Pure: no screen, no database. The
// map is MAP_WIDTH by MAP_HEIGHT (lib/world-map-data.ts); the part in view is its top-left corner and a zoom: at zoom 1 the whole globe shows, at zoom 8 an
// eighth of its width and height.

import { MAP_HEIGHT, MAP_WIDTH } from "./world-map-data";

export interface View {
  /** 1 (the whole globe) up to MAX_ZOOM. */
  k: number;
  /** The top-left corner of what is in view, in map units. */
  x: number;
  y: number;
}

export const MAX_ZOOM = 8;
/** One press of a zoom button, and one turn of the wheel with Ctrl held, change the zoom by this much. */
export const ZOOM_STEP = 1.6;

export const WHOLE_GLOBE: View = { k: 1, x: 0, y: 0 };

export const viewSize = (v: View) => ({ w: MAP_WIDTH / v.k, h: MAP_HEIGHT / v.k });

/** The view brought back inside the map: a zoom from 1 to MAX_ZOOM, and no empty space past an edge. */
export function clampView(v: View): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(v.k) ? v.k : 1));
  const { w, h } = { w: MAP_WIDTH / k, h: MAP_HEIGHT / k };
  const x = Math.min(MAP_WIDTH - w, Math.max(0, Number.isFinite(v.x) ? v.x : 0));
  const y = Math.min(MAP_HEIGHT - h, Math.max(0, Number.isFinite(v.y) ? v.y : 0));
  return { k, x, y };
}

/** The view after zooming by `factor` while the map point (px, py) stays where it is on the screen. */
export function zoomAt(v: View, factor: number, px: number, py: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
  const before = viewSize(v);
  const after = { w: MAP_WIDTH / k, h: MAP_HEIGHT / k };
  const fx = (px - v.x) / before.w;
  const fy = (py - v.y) / before.h;
  return clampView({ k, x: px - fx * after.w, y: py - fy * after.h });
}

/** The view after moving the picture by a number of map units (a positive number moves the view right or down, so the picture seems to move left or up). */
export function panBy(v: View, dx: number, dy: number): View {
  return clampView({ ...v, x: v.x + dx, y: v.y + dy });
}

/** The map point under a place on the screen, given the screen box the map is drawn in. */
export function screenToMap(v: View, clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): [number, number] {
  const { w, h } = viewSize(v);
  return [v.x + ((clientX - box.left) / box.width) * w, v.y + ((clientY - box.top) / box.height) * h];
}

/** Map units for a number of screen pixels, so a drag of so many pixels moves the picture by the same distance under the finger. */
export function pixelsToMap(v: View, pixels: number, boxWidth: number): number {
  return (pixels / boxWidth) * (MAP_WIDTH / v.k);
}

/** Two fingers: the factor the zoom changes by, from how far apart they were and are. */
export function pinchFactor(before: { x: number; y: number }[], after: { x: number; y: number }[]): number {
  const d0 = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
  const d1 = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
  return d0 < 1 ? 1 : d1 / d0;
}

/** The words for the zoom, read out when it changes. */
export const zoomWords = (v: View) => (v.k <= 1.0001 ? "The whole world is in view." : `Zoomed in ${v.k.toFixed(1).replace(/\.0$/, "")} times.`);
