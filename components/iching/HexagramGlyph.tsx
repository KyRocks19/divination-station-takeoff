import type { LineValue } from "@/lib/iching-data";

interface Props {
  /** Six lines, bottom first, true for a solid (yang) line. */
  lines: boolean[];
  /** The value of each line in a cast (6, 7, 8 or 9), to mark the changing ones: a ring on a solid line, a cross on a broken one. */
  values?: LineValue[];
  /** What the picture says to a screen reader. */
  label: string;
  /** Hide the spoken label when the name is written next to the picture. */
  decorative?: boolean;
  className?: string;
}

const ROW = 14;

/**
 * One hexagram drawn by the app as six bars, the first line at the bottom (not taken from a font, so it looks the same on every device). A changing
 * line also carries a mark at its right end, so the change is not told by anything but the shape: a ring for an old solid line, a cross for an old broken one.
 */
export default function HexagramGlyph({ lines, values, label, decorative = false, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 84 84"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="butt"
    >
      {lines.map((yang, i) => {
        const y = 77 - i * ROW;
        const v = values?.[i];
        return (
          <g key={i}>
            {yang ? <path d={`M4 ${y} H60`} /> : <path d={`M4 ${y} H25 M39 ${y} H60`} />}
            {v === 9 && <circle cx="72" cy={y} r="4" strokeWidth={2.5} />}
            {v === 6 && <path d={`M68 ${y - 4} L76 ${y + 4} M76 ${y - 4} L68 ${y + 4}`} strokeWidth={2.5} />}
          </g>
        );
      })}
    </svg>
  );
}
