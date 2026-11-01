import { useId } from "react";
import { swingName, swingWords } from "@/lib/pendulum-swings";
import Styled from "@/components/ui/Styled";
import type { StyleMap } from "@/lib/apply-style";

interface Props {
  shape: string;
  /** Whole degrees clockwise from straight up and down, for a line. */
  angle: number | null;
  /** What the swing is called, said aloud for the picture. Left out, it is "Line at 45°" and so on. */
  label?: string;
  /** Slow movement. Off for the small pictures in lists. */
  moving?: boolean;
  /** How fast it moves compared with the usual: 1 is usual, 0.5 half as fast, 2 twice as fast. */
  speed?: number;
  className?: string;
}

// How far the weight travels from the middle of the board, in the picture's own units (the board is 200 wide).
const LINE_REACH = 62;
const CIRCLE_RADIUS = 50;

const GUIDE = "#8a80b8";

/**
 * A pendulum's board seen from above, drawn by the app: a dark disc with a faint ring or two, a weight, and a faint
 * guide that shows where this swing goes (a line at its angle, a circle with an arrow, or nothing for still).
 * Angles run clockwise from straight up and down on the board. The weight moves slowly and softly and never
 * flashes; the classes that move it are in app/globals.css, which also keeps everything still when the device asks
 * for reduced motion, so the guide alone then shows the swing.
 */
export default function PendulumBoard({ shape, angle, label, moving = true, speed = 1, className = "" }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const speedVar = { "--pend-speed": String(speed) } as React.CSSProperties;
  const swing = { shape, angle };
  const description = `${label ?? swingName(swing)}. ${swingWords(swing)}`;

  const rad = ((angle ?? 0) * Math.PI) / 180;
  // The weight's furthest points along a line: straight up and down is 0 degrees, straight across is 90.
  const dx = Math.sin(rad) * LINE_REACH;
  const dy = -Math.cos(rad) * LINE_REACH;
  const lineVars = { "--dx": `${dx.toFixed(2)}px`, "--dy": `${dy.toFixed(2)}px` } as React.CSSProperties;

  const weight = (cx: number, cy: number) => (
    <>
      <circle cx={cx} cy={cy} r="13" fill="#9d8ff0" fillOpacity="0.12" />
      <circle cx={cx} cy={cy} r="7" fill="#d4cdf5" fillOpacity="0.85" stroke="#ffffff" strokeOpacity="0.15" />
    </>
  );

  return (
    <Styled as="svg" viewBox="0 0 200 200" role="img" aria-label={description} className={className} css={speedVar as StyleMap}>
      <defs>
        <radialGradient id={`${uid}-board`} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#171430" />
          <stop offset="75%" stopColor="#09091a" />
          <stop offset="100%" stopColor="#040409" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="95" fill="#1c182b" stroke="#3a3157" strokeWidth="2" />
      <circle cx="100" cy="100" r="88" fill={`url(#${uid}-board)`} />
      <circle cx="100" cy="100" r="40" fill="none" stroke={GUIDE} strokeOpacity="0.07" />
      <circle cx="100" cy="100" r="70" fill="none" stroke={GUIDE} strokeOpacity="0.05" />

      <g className={moving ? "pend-fade" : undefined}>
        {shape === "line" && (
          <>
            <line
              x1={100 - dx * 1.14}
              y1={100 - dy * 1.14}
              x2={100 + dx * 1.14}
              y2={100 + dy * 1.14}
              stroke={GUIDE}
              strokeOpacity="0.2"
              strokeWidth="1"
            />
            <circle cx={100 + dx * 1.14} cy={100 + dy * 1.14} r="2" fill={GUIDE} fillOpacity="0.3" />
            <circle cx={100 - dx * 1.14} cy={100 - dy * 1.14} r="2" fill={GUIDE} fillOpacity="0.3" />
            <Styled as="g" className={moving ? "pend-move pend-line" : undefined} css={lineVars as StyleMap}>
              {weight(100, 100)}
            </Styled>
          </>
        )}

        {(shape === "circle_cw" || shape === "circle_ccw") && (
          <>
            <circle
              cx="100"
              cy="100"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke={GUIDE}
              strokeOpacity="0.2"
              strokeDasharray="3 5"
            />
            {/* An arrow on the ring: pointing right at the top is clockwise as seen from above. */}
            <path
              d={shape === "circle_cw" ? "M 95 45 L 105 50 L 95 55 Z" : "M 105 45 L 95 50 L 105 55 Z"}
              fill={GUIDE}
              fillOpacity="0.3"
            />
            <g className={moving ? `pend-move pend-orbit${shape === "circle_ccw" ? " pend-ccw" : ""}` : undefined}>
              {weight(100, 100 - CIRCLE_RADIUS)}
            </g>
          </>
        )}

        {shape === "still" && (
          <>
            <circle cx="100" cy="100" r="16" fill="none" stroke={GUIDE} strokeOpacity="0.2" strokeDasharray="3 5" />
            {weight(100, 100)}
          </>
        )}
      </g>
    </Styled>
  );
}
