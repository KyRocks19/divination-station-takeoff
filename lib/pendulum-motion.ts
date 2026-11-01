import type { SwingShape } from "./pendulum-swings";

// Turns a few seconds of a phone's movement into the shape of the swing it made: a line at an angle, a circle
// either way, or still. Only this summary is ever sent to the server, never the sensor readings. This file touches no
// browser or database code, so it can be tested with made-up movement.
//
// The phone is held flat, screen up, with the top edge pointing away from the person, so what the screen shows is
// the pendulum's board seen from above. The sensor's own axes are used as they are: x to the right, y towards the top
// edge. A line's angle is measured clockwise from straight up and down on the board, like the swings themselves.

/** One reading of the phone's acceleration in metres per second squared, with gravity left out. */
export interface MotionPoint {
  x: number;
  y: number;
}

/** What the movement was. `angle` is set for a line only, in degrees from 0 up to 180. */
export interface MotionReading {
  shape: SwingShape;
  angle: number | null;
}

/** The fewest readings worth looking at. A phone sends about 60 a second, so this is about a second of movement. */
export const MIN_MOTION_SAMPLES = 60;

/** An acceleration (root mean square, in m/s²) below which the phone counts as still. A hand at rest trembles below this. */
export const STILL_BELOW = 0.3;

/** How thin the movement has to be, as the weaker direction over the stronger, to count as a line. A circle is near 1. */
export const LINE_BELOW = 0.3;

/** A moving average over `window` readings, to take the shake out of the sensor. */
function smooth(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j];
      count++;
    }
    return sum / count;
  });
}

/** What shape of swing the movement made, or null when there are too few readings to say. */
export function readMotion(points: MotionPoint[]): MotionReading | null {
  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (usable.length < MIN_MOTION_SAMPLES) return null;

  // Take out any steady push (gravity leaking in, or the hand leaning) so only the changes in movement are left.
  const meanX = usable.reduce((s, p) => s + p.x, 0) / usable.length;
  const meanY = usable.reduce((s, p) => s + p.y, 0) / usable.length;
  const xs = smooth(usable.map((p) => p.x - meanX), 5);
  const ys = smooth(usable.map((p) => p.y - meanY), 5);

  const n = xs.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += xs[i] * xs[i];
    syy += ys[i] * ys[i];
    sxy += xs[i] * ys[i];
  }
  sxx /= n;
  syy /= n;
  sxy /= n;

  if (Math.sqrt(sxx + syy) < STILL_BELOW) return { shape: "still", angle: null };

  // The two spreads of the movement (the longer and the shorter way across it) and the direction of the longer one.
  const centre = (sxx + syy) / 2;
  const radius = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
  const strong = centre + radius;
  const weak = Math.max(0, centre - radius);

  if (weak / strong < LINE_BELOW) {
    // The longer direction, as an angle from the x axis, turned into degrees clockwise from the y axis.
    const fromX = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI;
    const bearing = (((90 - fromX) % 180) + 180) % 180;
    const angle = Math.round(bearing * 10) / 10;
    return { shape: "line", angle: angle >= 180 ? 0 : angle };
  }

  // Round and round: which way the movement turns. The area swept by the path is positive when it turns
  // counter-clockwise as seen from above (x to the right, y up) and negative when it turns clockwise.
  let turn = 0;
  for (let i = 0; i + 1 < n; i++) turn += xs[i] * ys[i + 1] - ys[i] * xs[i + 1];
  return { shape: turn < 0 ? "circle_cw" : "circle_ccw", angle: null };
}

/** How far apart two line angles are, in degrees, from 0 to 90: a line at 175 is close to a line at 5. */
export function lineGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

/**
 * Which of the swings in play the movement matches: the same shape, and for a line the nearest angle. Null when none of
 * them has that shape, so the caller can say so instead of picking something else.
 */
export function nearestSwing<T extends { shape: string; angle: number | null }>(inPlay: T[], reading: MotionReading): T | null {
  const same = inPlay.filter((s) => s.shape === reading.shape);
  if (same.length === 0) return null;
  if (reading.shape !== "line" || reading.angle === null) return same[0];
  const at = reading.angle;
  return same.reduce((best, s) => (lineGap(s.angle ?? 0, at) < lineGap(best.angle ?? 0, at) ? s : best));
}

/** The words for what the movement was, for the answer page: "a line at about 40°", "a circle clockwise", "no movement". */
export function motionWords(shape: string | null, angle: number | null): string {
  if (shape === "circle_cw") return "a circle, clockwise";
  if (shape === "circle_ccw") return "a circle, counter-clockwise";
  if (shape === "still") return "no movement";
  return angle === null ? "a line" : `a line at about ${angle}°`;
}
