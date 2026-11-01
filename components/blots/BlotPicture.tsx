import { BLOT_SIZE, blotPaths } from "@/lib/blots-core";

/**
 * The ink blot for a seed, drawn the same way every time: a blot with its mirror image across a fold. It is a picture only: the words beside it say what it
 * is, and nothing says what it means. Cups of tea leaves are drawn by components/tea/TeaCupPicture.tsx.
 */
export default function BlotPicture({ seed, label }: { seed: number; label: string }) {
  const s = BLOT_SIZE;
  const paths = blotPaths(seed, "ink");
  return (
    <svg viewBox={`0 0 ${s} ${s}`} role="img" aria-label={label} className="w-full max-w-sm mx-auto rounded-card border border-line text-tone-100 bg-canvas">
      <g fill="currentColor" fillOpacity={0.92}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="currentColor" fillOpacity="0.92" transform={`translate(${s} 0) scale(-1 1)`}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
