import { APP_SIGIL_DOTS, APP_SIGIL_FILLS, APP_SIGIL_LINE_RATIO, APP_SIGIL_RAYS, APP_SIGIL_STROKE, APP_SIGIL_STROKES, APP_SIGIL_TRANSFORM, APP_SIGIL_VIEWBOX } from "@/lib/app-sigil-core";

/**
 * The app's logo: the scrying-bowl sigil drawn from the owner's sketch, in place of the four-pointed star. It is a decoration
 * (the app's name is always written beside it), takes the text colour so every theme colours it, and its size comes from
 * `className`. `strokeWidth` is for small sizes, where a heavier pen keeps it readable.
 */
export default function AppSigil({
  className = "h-6 w-6",
  strokeWidth = APP_SIGIL_STROKE,
  x,
  y,
  size,
}: {
  className?: string;
  strokeWidth?: number;
  /** Only inside another drawing (a card's place in a spread): where its top left corner goes, and its width and height. */
  x?: number;
  y?: number;
  size?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${APP_SIGIL_VIEWBOX} ${APP_SIGIL_VIEWBOX}`}
      x={x}
      y={y}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <g transform={APP_SIGIL_TRANSFORM}>
        {APP_SIGIL_FILLS.map((d) => (
          <path key={d} d={d} fill="currentColor" stroke="none" />
        ))}
        {APP_SIGIL_STROKES.map((d) => (
          <path key={d} d={d} strokeWidth={strokeWidth * APP_SIGIL_LINE_RATIO} />
        ))}
        <path d={APP_SIGIL_RAYS} />
        {APP_SIGIL_DOTS.map(({ cx, cy, r }) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
        ))}
      </g>
    </svg>
  );
}

/**
 * The sigil as a mark inside a line of words, where the four-pointed star used to stand (owner's request, 2026-10-26: the
 * star now marks only what is for administrators). It is as tall as the letters around it, so the text size sets its size.
 */
export function SigilMark({ className = "" }: { className?: string }) {
  return <AppSigil className={`inline-block h-[1.15em] w-[1.15em] align-[-0.2em] ${className}`} strokeWidth={3.4} />;
}
