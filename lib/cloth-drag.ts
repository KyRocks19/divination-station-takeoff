// Dragging a zone on the picture of a cloth: which dots (handles) a shape has, and what moving one does to the shape. Pure, no imports from the
// database, so the browser and the tests use it. Dragging is only an extra: every shape is also typed in the boxes (lib/cloth-form.ts), and the editor
// writes a dragged shape back into those boxes, so the typed way and the dragged way always agree.

import { CLOTH_SIZE, angleFrom, cleanGeom, polygonArea, type Geom } from "./cloth-core";

export interface Handle {
  /** Names the dot within one shape: "c" for a centre, "r" for a radius, "p2" for the third corner of a freehand zone, and so on. */
  id: string;
  x: number;
  y: number;
  /** A short plain name, for the picture's description. */
  label: string;
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
const onCloth = (v: number) => clampInt(v, 0, CLOTH_SIZE);
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round(cx + r * Math.sin(rad)), y: Math.round(cy - r * Math.cos(rad)) };
};
const dist = (cx: number, cy: number, x: number, y: number) => Math.hypot(x - cx, y - cy);

/** The dots a shape shows for dragging, at the places they are now. */
export function handlesFor(g: Geom): Handle[] {
  switch (g.shape) {
    case "circle":
      return [{ id: "c", x: g.cx, y: g.cy, label: "centre" }, { id: "r", x: g.cx + g.r, y: g.cy, label: "radius" }];
    case "ring":
      return [
        { id: "c", x: g.cx, y: g.cy, label: "centre" },
        { id: "r", x: g.cx + g.r, y: g.cy, label: "outer radius" },
        { id: "ri", x: g.cx + g.ri, y: g.cy, label: "inner radius" },
      ];
    case "rectangle":
      return [
        { id: "nw", x: g.x, y: g.y, label: "top left corner" },
        { id: "move", x: g.x + Math.round(g.w / 2), y: g.y + Math.round(g.h / 2), label: "middle" },
        { id: "se", x: g.x + g.w, y: g.y + g.h, label: "bottom right corner" },
      ];
    case "half":
      return [
        g.edge === "left" ? { id: "line", x: g.at, y: CLOTH_SIZE / 2, label: "line" }
          : g.edge === "right" ? { id: "line", x: CLOTH_SIZE - g.at, y: CLOTH_SIZE / 2, label: "line" }
          : g.edge === "top" ? { id: "line", x: CLOTH_SIZE / 2, y: g.at, label: "line" }
          : { id: "line", x: CLOTH_SIZE / 2, y: CLOTH_SIZE - g.at, label: "line" },
      ];
    case "wedge": {
      const a = polar(g.cx, g.cy, g.r, g.start);
      const b = polar(g.cx, g.cy, g.r, g.start + g.sweep);
      return [
        { id: "c", x: g.cx, y: g.cy, label: "centre" },
        { id: "start", x: a.x, y: a.y, label: "start of the slice" },
        { id: "end", x: b.x, y: b.y, label: "end of the slice" },
      ];
    }
    case "freehand":
      return g.points.map(([x, y], i) => ({ id: `p${i}`, x, y, label: `corner ${i + 1}` }));
  }
}

/**
 * The shape after the dot `id` is dragged to (x, y), in cloth units. The result always passes `cleanGeom`; a drag that would make the shape unusable
 * (a ring whose inner radius passes its outer one, corners that fall in a line) leaves the shape as it was.
 */
export function dragTo(g: Geom, id: string, x: number, y: number): Geom {
  const next = moved(g, id, x, y);
  const ok = cleanGeom(next);
  return ok.ok ? ok.geom : g;
}

function moved(g: Geom, id: string, x: number, y: number): Geom {
  switch (g.shape) {
    case "circle":
      if (id === "c") return { ...g, cx: onCloth(x), cy: onCloth(y) };
      if (id === "r") return { ...g, r: clampInt(dist(g.cx, g.cy, x, y), 1, CLOTH_SIZE) };
      return g;
    case "ring":
      if (id === "c") return { ...g, cx: onCloth(x), cy: onCloth(y) };
      if (id === "r") return { ...g, r: clampInt(dist(g.cx, g.cy, x, y), g.ri + 1, CLOTH_SIZE) };
      if (id === "ri") return { ...g, ri: clampInt(dist(g.cx, g.cy, x, y), 1, g.r - 1) };
      return g;
    case "rectangle": {
      if (id === "move") {
        const nx = clampInt(x - g.w / 2, 0, CLOTH_SIZE - 1);
        const ny = clampInt(y - g.h / 2, 0, CLOTH_SIZE - 1);
        return { ...g, x: nx, y: ny };
      }
      if (id === "se") return { ...g, w: clampInt(x - g.x, 1, CLOTH_SIZE), h: clampInt(y - g.y, 1, CLOTH_SIZE) };
      if (id === "nw") {
        const right = g.x + g.w;
        const bottom = g.y + g.h;
        const nx = clampInt(x, 0, right - 1);
        const ny = clampInt(y, 0, bottom - 1);
        return { ...g, x: nx, y: ny, w: right - nx, h: bottom - ny };
      }
      return g;
    }
    case "half":
      if (id !== "line") return g;
      return {
        ...g,
        at: clampInt(g.edge === "left" ? x : g.edge === "right" ? CLOTH_SIZE - x : g.edge === "top" ? y : CLOTH_SIZE - y, 1, CLOTH_SIZE - 1),
      };
    case "wedge": {
      if (id === "c") return { ...g, cx: onCloth(x), cy: onCloth(y) };
      if (x === g.cx && y === g.cy) return g;
      const angle = Math.round(angleFrom(g.cx, g.cy, x, y)) % 360;
      if (id === "start") {
        // The end of the slice stays where it is; the start turns, and the width follows.
        const end = (g.start + g.sweep) % 360;
        const sweep = (end - angle + 360) % 360;
        return sweep === 0 ? g : { ...g, start: angle, sweep };
      }
      if (id === "end") {
        const sweep = (angle - g.start + 360) % 360;
        return sweep === 0 ? g : { ...g, sweep, r: clampInt(dist(g.cx, g.cy, x, y), 1, CLOTH_SIZE) };
      }
      return g;
    }
    case "freehand": {
      const i = /^p(\d+)$/.exec(id)?.[1];
      if (i === undefined || Number(i) >= g.points.length) return g;
      const points = g.points.map((p, k) => (k === Number(i) ? ([onCloth(x), onCloth(y)] as [number, number]) : p));
      return polygonArea(points) === 0 ? g : { ...g, points };
    }
  }
}
