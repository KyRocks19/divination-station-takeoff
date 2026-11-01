// The numbers of a zone as a form holds them: text boxes of percents (and degrees for a wedge), and back to the zone's geometry. No imports from the
// database, so the browser and the tests use it. The typed form is the real way to make a zone; dragging is only an extra.

import { cleanGeom, defaultGeom, fromPercent, toPercent, type Geom, type ZoneShape } from "./cloth-core";

/** The text boxes of one zone's shape, by field name. Percents of the cloth (0 to 100) except `start` and `sweep` (degrees) and `edge`. */
export type GeomForm = Record<string, string>;

/** The fields each shape asks for, in order, with the words for their labels and which of them are degrees. */
export const SHAPE_FIELDS: Record<ZoneShape, { name: string; label: string; unit: "%" | "°" | "side" | "list" }[]> = {
  circle: [
    { name: "cx", label: "Centre, across from the left", unit: "%" },
    { name: "cy", label: "Centre, down from the top", unit: "%" },
    { name: "r", label: "Radius", unit: "%" },
  ],
  ring: [
    { name: "cx", label: "Centre, across from the left", unit: "%" },
    { name: "cy", label: "Centre, down from the top", unit: "%" },
    { name: "r", label: "Outer radius", unit: "%" },
    { name: "ri", label: "Inner radius", unit: "%" },
  ],
  rectangle: [
    { name: "x", label: "Left edge, across from the left", unit: "%" },
    { name: "y", label: "Top edge, down from the top", unit: "%" },
    { name: "w", label: "Width", unit: "%" },
    { name: "h", label: "Height", unit: "%" },
  ],
  half: [
    { name: "edge", label: "Which side of the cloth", unit: "side" },
    { name: "at", label: "The line, in from that side", unit: "%" },
  ],
  wedge: [
    { name: "cx", label: "Centre, across from the left", unit: "%" },
    { name: "cy", label: "Centre, down from the top", unit: "%" },
    { name: "r", label: "Radius", unit: "%" },
    { name: "start", label: "Starts at (0 is straight up, turning clockwise)", unit: "°" },
    { name: "sweep", label: "Width of the slice", unit: "°" },
  ],
  freehand: [{ name: "points", label: "Corners, one per line as across,down", unit: "list" }],
};

const pct = (n: number) => String(toPercent(n));

/** A geometry as text for the form. */
export function geomToForm(g: Geom): GeomForm {
  switch (g.shape) {
    case "circle":
      return { cx: pct(g.cx), cy: pct(g.cy), r: pct(g.r) };
    case "ring":
      return { cx: pct(g.cx), cy: pct(g.cy), r: pct(g.r), ri: pct(g.ri) };
    case "rectangle":
      return { x: pct(g.x), y: pct(g.y), w: pct(g.w), h: pct(g.h) };
    case "half":
      return { edge: g.edge, at: pct(g.at) };
    case "wedge":
      return { cx: pct(g.cx), cy: pct(g.cy), r: pct(g.r), start: String(g.start), sweep: String(g.sweep) };
    case "freehand":
      return { points: g.points.map(([x, y]) => `${pct(x)},${pct(y)}`).join("\n") };
  }
}

/** The starting text of a new zone of a shape. */
export const defaultForm = (shape: ZoneShape): GeomForm => geomToForm(defaultGeom(shape));

/** A number typed in a box: plain digits with at most one decimal point or comma, or null. */
export function typedNumber(text: string | undefined): number | null {
  const t = (text ?? "").trim().replace(",", ".");
  return /^-?\d{1,4}(\.\d{1,2})?$/.test(t) ? Number(t) : null;
}

/** The form's text as a geometry, or the plain sentence saying what is wrong. Percents become whole units (tenths of a percent). */
export function formToGeom(shape: ZoneShape, form: GeomForm): { ok: true; geom: Geom } | { ok: false; error: string } {
  const num = (name: string) => typedNumber(form[name]);
  const unit = (name: string) => {
    const n = num(name);
    return n === null ? null : fromPercent(n);
  };
  const need = (...names: string[]) => names.every((n) => num(n) !== null);
  const missing = { ok: false as const, error: "Fill in every box with a number." };
  switch (shape) {
    case "circle":
      return need("cx", "cy", "r") ? cleanGeom({ shape, cx: unit("cx"), cy: unit("cy"), r: unit("r") }) : missing;
    case "ring":
      return need("cx", "cy", "r", "ri") ? cleanGeom({ shape, cx: unit("cx"), cy: unit("cy"), r: unit("r"), ri: unit("ri") }) : missing;
    case "rectangle":
      return need("x", "y", "w", "h") ? cleanGeom({ shape, x: unit("x"), y: unit("y"), w: unit("w"), h: unit("h") }) : missing;
    case "half":
      return need("at") ? cleanGeom({ shape, edge: form.edge, at: unit("at") }) : missing;
    case "wedge":
      return need("cx", "cy", "r", "start", "sweep") ? cleanGeom({ shape, cx: unit("cx"), cy: unit("cy"), r: unit("r"), start: num("start"), sweep: num("sweep") }) : missing;
    case "freehand": {
      const lines = (form.points ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const points: [number, number][] = [];
      for (const line of lines) {
        const [a, b, ...rest] = line.split(/[,;\s]+/);
        const x = typedNumber(a);
        const y = typedNumber(b);
        if (x === null || y === null || rest.length) return { ok: false, error: `Each corner is two numbers like 25,60. This line is not: "${line.slice(0, 30)}"` };
        points.push([fromPercent(x), fromPercent(y)]);
      }
      return cleanGeom({ shape, points });
    }
  }
}
