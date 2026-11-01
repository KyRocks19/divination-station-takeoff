import { BLOT_SIZE, TEA_CUP, blotPaths, teaLeaves } from "@/lib/blots-core";
import { PORCELAIN, getTea, type TeaKind } from "@/lib/tea-core";

/**
 * The leaves in a cup for a seed, drawn the same way every time. It is a picture only: the words beside it say what it is, and nothing says what it means.
 *
 * A cup with a chosen tea (2026-10-25) is drawn as a white cup with its handle on the right, a faint stain of the tea, and leaves shaped and coloured like that
 * tea's. Its colours are the picture's own and stay the same in every theme, as a real cup does. A cup saved before teas could be chosen is drawn as before:
 * a pale bowl seen from above, in the theme's colours.
 */
export default function TeaCupPicture({ seed, label, tea = null }: { seed: number; label: string; tea?: TeaKind | null }) {
  if (tea) return <TeaCup seed={seed} tea={tea} label={label} />;
  const s = BLOT_SIZE;
  const paths = blotPaths(seed, "cup");
  return (
    <svg viewBox={`0 0 ${s} ${s}`} role="img" aria-label={label} className="w-full max-w-sm mx-auto rounded-card border border-line text-tone-100 bg-canvas">
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="3" />
      <circle cx="100" cy="100" r="78" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <g fill="currentColor" fillOpacity={0.8}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

function TeaCup({ seed, tea, label }: { seed: number; tea: TeaKind; label: string }) {
  const t = getTea(tea);
  const pieces = teaLeaves(seed, tea);
  const { cx, cy, bowl, rim } = TEA_CUP;
  const colour = { leaf: t.leaf, light: t.leafLight, dust: t.leaf };
  const gradientId = `tea-stain-${seed}-${tea}`;
  return (
    <svg viewBox={`0 0 ${BLOT_SIZE} ${BLOT_SIZE}`} role="img" aria-label={label} className="w-full max-w-sm mx-auto rounded-card border border-line bg-canvas">
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={t.liquor} stopOpacity="0.22" />
          <stop offset="70%" stopColor={t.liquor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={t.liquor} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* The saucer, the handle on the right, the rim and the inside of the bowl. */}
      <circle cx={cx} cy={cy} r={rim + 8} fill={PORCELAIN.saucer} fillOpacity="0.35" />
      <path d={`M${cx + rim - 4} ${cy - 14}C${cx + rim + 18} ${cy - 18} ${cx + rim + 18} ${cy + 18} ${cx + rim - 4} ${cy + 14}`} fill="none" stroke={PORCELAIN.rim} strokeWidth="7" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={rim} fill={PORCELAIN.rim} />
      <circle cx={cx} cy={cy} r={bowl} fill={PORCELAIN.bowl} stroke={PORCELAIN.shade} strokeWidth="1.5" />
      {/* What the tea leaves behind: a faint stain, and a tide line where the last of it stood. */}
      <circle cx={cx} cy={cy} r={bowl - 2} fill={`url(#${gradientId})`} />
      <circle cx={cx} cy={cy} r={bowl * 0.62} fill="none" stroke={t.liquor} strokeOpacity="0.18" strokeWidth="1.2" />
      {pieces.map((p, i) => (
        <path key={i} d={p.d} fill={colour[p.tone]} fillOpacity={p.opacity} />
      ))}
    </svg>
  );
}
