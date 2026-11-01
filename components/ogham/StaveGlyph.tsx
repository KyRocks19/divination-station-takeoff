import { getStave } from "@/lib/ogham-data";

interface Props {
  staveId: string;
  /** Hide the spoken label when the name is written next to the picture. */
  decorative?: boolean;
  className?: string;
}

/**
 * One ogham stave drawn by the app as strokes: a line up the middle with the letter's strokes cut across, left of,
 * or right of it. Nothing moves.
 */
export default function StaveGlyph({ staveId, decorative = false, className = "" }: Props) {
  const stave = getStave(staveId);
  if (!stave) return null;
  return (
    <svg
      viewBox="0 0 60 100"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : stave.name}
      aria-hidden={decorative ? true : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {stave.strokes.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
