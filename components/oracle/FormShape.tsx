import { cleanForm, type SetForm } from "@/lib/oracle-forms";

/**
 * A small drawing of one item of a set: a card, a stone, a stave, or a charm. It is decoration, so a screen reader
 * skips it; the words beside it already say which form it is. It takes its colour from the text colour around it.
 */
export default function FormShape({
  form,
  height = 40,
  className = "",
}: {
  form: SetForm | string | null | undefined;
  /** The drawing's height in pixels; the width follows the shape. */
  height?: number;
  className?: string;
}) {
  const f = cleanForm(form) ?? "cards";
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  // Each shape is drawn in a 48 by 64 box (a stave in a 16 by 64 box) and scaled by `height`.
  const w = f === "staves" ? 16 : 48;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${w} 64`}
      height={height}
      width={(height * w) / 64}
      className={`shrink-0 ${className}`}
    >
      {f === "cards" && (
        <>
          <rect x="6" y="4" width="36" height="56" rx="4" {...common} />
          <rect x="12" y="10" width="24" height="44" rx="2" {...common} opacity="0.5" />
        </>
      )}
      {f === "stones" && (
        <>
          <path d="M8 36 C6 24 14 14 25 14 C38 14 44 24 42 38 C40 50 30 54 22 53 C13 52 9 46 8 36 Z" {...common} />
          <path d="M16 30 C19 24 24 22 29 23" {...common} opacity="0.5" />
        </>
      )}
      {f === "staves" && (
        <>
          <rect x="3" y="2" width="10" height="60" rx="5" {...common} />
          <path d="M3 18 H13 M3 32 H13 M3 46 H13" {...common} opacity="0.5" />
        </>
      )}
      {f === "charms" && (
        <>
          <circle cx="24" cy="38" r="17" {...common} />
          <circle cx="24" cy="9" r="5" {...common} />
          <path d="M24 14 V21" {...common} />
          <circle cx="24" cy="38" r="6" {...common} opacity="0.5" />
        </>
      )}
    </svg>
  );
}
