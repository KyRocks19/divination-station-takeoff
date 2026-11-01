// The app's own sigil, drawn from the owner's sketch and her choices (2026-10-26): a scrying bowl resting on a horizon, an
// upright standing in its right side with a horn (handle) rising up and to the right, and a half-circle of light rising out of the
// water with five rays fanning above it, and an eye resting in the water. Pure data, so the header component and the icon script (`scripts/gen-icons.mts`)
// draw the very same shape. A 48 by 48 box; the drawing takes the text colour.
// This is the logo of the app. It has nothing to do with a person's own sigil (`components/Sigil*.tsx`), which is private.

export const APP_SIGIL_VIEWBOX = 48;

/** Places the drawing in the middle of the box. */
export const APP_SIGIL_TRANSFORM = "translate(2.4 5.2) scale(0.9)";

/** Lines, drawn with a round pen. */
export const APP_SIGIL_STROKES: readonly string[] = [
  // The rim of the bowl (the surface of the water), then its round side from the left end of the rim to the right end.
  "M4 24.6 H37.8 M4 24.6 C4 30 10 37.1 18.7 37.1 C30 37.1 38.5 33 37.8 24.6",
  // The horizon the bowl rests on.
  "M1.5 37.1 H46.5",
  // The upright, and the horn rising from its top and curving back down to the rim.
  "M29.9 35.6 V16.7 L44 10.5 C39 15 37 19 37.8 24.6",
  // The line across the handle, cutting it into a squareish part above the rim and a small tip.
  "M29.9 16.7 H38.9",
];

/** Five rays of light fanning out above the water, long and short in turn. Drawn with the full pen; the other lines are a little thinner. */
export const APP_SIGIL_RAYS = "M17 16 V7.6 M13.78 16.63 L11.76 11.62 M20.22 16.63 L22.24 11.62 M11.03 18.41 L8.66 15.97 M22.97 18.41 L25.34 15.97";

/** How much thinner the lines are than the rays (the owner's choice, 2026-10-26). */
export const APP_SIGIL_LINE_RATIO = 0.82;

/** Shapes filled with the same colour: the half-circle of light rising out of the water. Its flat bottom lies on the rim, inside the rim line, so no edge of it shows: it is drawn first, with no pen, and the rim is drawn over it. */
export const APP_SIGIL_FILLS: readonly string[] = ["M11.9 24.6 A5.1 5.1 0 0 1 22.1 24.6 Z"];

/** Dots: the eye resting in the water below the light. */
export const APP_SIGIL_DOTS: readonly { cx: number; cy: number; r: number }[] = [{ cx: 17, cy: 30.6, r: 2.1 }];

/** The pen width in the 48 box. Smaller pictures need a heavier pen to stay readable (the favicon uses 4). */
export const APP_SIGIL_STROKE = 2.6;
