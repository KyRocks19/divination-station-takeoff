import { boardFor, strokePath, type Drawing } from "@/lib/oracle-art";
import { IDEOGRAM_FORM } from "@/lib/remoteview-core";

/** A quick drawing made on the drawing board, shown as it was drawn. It is a picture only; the words around it say what it is. */
export default function IdeogramPicture({ drawing, label }: { drawing: Drawing; label: string }) {
  const { w, h } = boardFor(IDEOGRAM_FORM);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="w-full max-w-xs rounded-card border border-line">
      <rect width={w} height={h} fill={drawing.background} />
      {drawing.strokes.map((s, i) => (
        <path key={i} d={strokePath(s.p)} stroke={s.c} strokeWidth={s.w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
