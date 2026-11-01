import { getFigure, type Figure } from "@/lib/geomancy-data";
import { LINE_ELEMENTS } from "@/lib/geomancy-data";

interface Props {
  /** A figure, or the id of one ('geomancy-via'). */
  figure: Figure | string;
  /** Hide the spoken label when the name is written next to the picture. */
  decorative?: boolean;
  className?: string;
}

/** The dots of a figure as the app draws them: four rows, the top (Fire) line first, a single dot in the middle or a double dot split to the sides. */
export default function FigureGlyph({ figure, decorative = false, className = "" }: Props) {
  const x = typeof figure === "string" ? getFigure(figure) : figure;
  if (!x) return null;
  const label = `${x.latin}: ${x.lines.map((v, i) => `${LINE_ELEMENTS[i]} ${v === 1 ? "single dot" : "double dot"}`).join(", ")}`;
  return (
    <svg
      viewBox="0 0 40 64"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      fill="currentColor"
    >
      {x.lines.map((v, i) => {
        const y = 8 + i * 16;
        return v === 1 ? (
          <circle key={i} cx={20} cy={y} r={5} />
        ) : (
          <g key={i}>
            <circle cx={9} cy={y} r={5} />
            <circle cx={31} cy={y} r={5} />
          </g>
        );
      })}
    </svg>
  );
}
