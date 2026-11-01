import { getRune } from "@/lib/runes-data";

interface Props {
  runeId: string;
  /** Turned upside down, as when a rune lands reversed. */
  reversed?: boolean;
  /** Hide the spoken label when the name is written next to the picture. */
  decorative?: boolean;
  className?: string;
}

/**
 * One rune drawn by the app as strokes (not taken from a font, so it looks the same on every device). A reversed
 * rune is the same drawing turned half way round. Nothing moves.
 */
export default function RuneGlyph({ runeId, reversed = false, decorative = false, className = "" }: Props) {
  const rune = getRune(runeId);
  if (!rune) return null;
  const label = `${rune.name}${reversed ? ", upside down" : ""}`;
  return (
    <svg
      viewBox="0 0 60 100"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform={reversed ? "rotate(180 30 50)" : undefined}>
        {rune.strokes.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
