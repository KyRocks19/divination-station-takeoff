"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import {
  BACKGROUND_COLORS,
  PEN_COLORS,
  PEN_SIZES,
  boardFor,
  isRound,
  strokePath,
  type Drawing,
  type Stroke,
} from "@/lib/oracle-art";
import { applyStyle, styleRef } from "@/lib/apply-style";

const SIZE_NAMES = ["Fine", "Medium", "Broad"];

/**
 * A board to draw on with a finger, a pen, or a mouse, at the shape of the set's form. Strokes are kept as lines, not
 * as pixels, so a drawing can be opened and changed again. Drawing needs a pointer; the person can upload a picture
 * instead, and every drawing can be given a written description.
 */
export default function DrawingBoard({
  form,
  initial,
  saving,
  onSave,
  onCancel,
}: {
  form: string;
  initial: Drawing | null;
  saving: boolean;
  onSave: (drawing: Drawing) => void;
  onCancel: () => void;
}) {
  const { w, h } = boardFor(form);
  const svg = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes ?? []);
  const [background, setBackground] = useState(initial?.background ?? BACKGROUND_COLORS[0]);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [live, setLive] = useState<[number, number][] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const drawing = useRef<{ id: number } | null>(null);

  function point(e: React.PointerEvent): [number, number] {
    const el = svg.current!;
    const ctm = el.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [Math.min(w, Math.max(0, Math.round(p.x * 10) / 10)), Math.min(h, Math.max(0, Math.round(p.y * 10) / 10))];
  }

  // The points of the stroke being drawn are kept in a ref as well as in state: state draws the live line, the ref is
  // what gets saved when the pen lifts (a state updater must not have side effects).
  const livePoints = useRef<[number, number][]>([]);

  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { id: e.pointerId };
    setConfirmClear(false);
    livePoints.current = [point(e)];
    setLive([...livePoints.current]);
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing.current || drawing.current.id !== e.pointerId) return;
    const next = point(e);
    const pts = livePoints.current;
    const last = pts[pts.length - 1];
    if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 1.5 || pts.length >= 3000) return;
    pts.push(next);
    setLive([...pts]);
  }

  function up(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing.current || drawing.current.id !== e.pointerId) return;
    drawing.current = null;
    const pts = livePoints.current;
    livePoints.current = [];
    if (pts.length > 0) setStrokes((s) => [...s, { c: color, w: size, p: pts }].slice(-600));
    setLive(null);
  }

  const swatch = (c: string, active: boolean) =>
    `h-8 w-8 rounded-full border-2 shrink-0 ${active ? "border-focus ring-2 ring-focus" : "border-line-strong"}`;

  return (
    <div className="space-y-3">
      <div
        className={`mx-auto overflow-hidden border border-line-strong ${isRound(form) ? "rounded-full" : "rounded-card"}`}
        ref={styleRef({ width: `min(100%, calc(60vh * ${w} / ${h}))`, aspectRatio: `${w} / ${h}` })}
      >
        <svg
          ref={(el) => {
            svg.current = el;
            if (el) applyStyle(el, { background });
          }}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label="Drawing board. Draw with a finger, a pen, or a mouse."
          className="block w-full h-full cursor-crosshair touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {strokes.map((s, i) => (
            <path key={i} d={strokePath(s.p)} stroke={s.c} strokeWidth={s.w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {live && (
            <path d={strokePath(live)} stroke={color} strokeWidth={size} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>

      <div className="space-y-2">
        <div role="group" aria-label="Pen colour" className="flex flex-wrap gap-2">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Pen colour ${c}`}
              aria-pressed={color === c}
              className={swatch(c, color === c)}
              ref={styleRef({ background: c })}
            />
          ))}
        </div>
        <div role="group" aria-label="Pen width" className="flex gap-2">
          {PEN_SIZES.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              aria-pressed={size === s}
              className={`${size === s ? buttonClass.purple : buttonClass.quiet} text-xs`}
            >
              {SIZE_NAMES[i]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Background colour" className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-faint">Background</span>
          {BACKGROUND_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBackground(c)}
              aria-label={`Background colour ${c}`}
              aria-pressed={background === c}
              className={swatch(c, background === c)}
              ref={styleRef({ background: c })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={saving || strokes.length === 0} onClick={() => onSave({ background, strokes })} className={buttonClass.primary}>
          {saving ? "Saving…" : "Save drawing"}
        </button>
        <button type="button" disabled={strokes.length === 0} onClick={() => setStrokes((s) => s.slice(0, -1))} className={buttonClass.quiet}>
          Undo
        </button>
        {confirmClear ? (
          <span className="text-xs text-ink-muted">
            Clear the whole drawing?{" "}
            <button type="button" onClick={() => { setStrokes([]); setConfirmClear(false); }} className="text-danger-ink hover:text-danger-soft">
              Yes, clear it
            </button>{" "}
            <button type="button" onClick={() => setConfirmClear(false)} className="text-ink-faint hover:text-ink-soft">Keep it</button>
          </span>
        ) : (
          <button type="button" disabled={strokes.length === 0} onClick={() => setConfirmClear(true)} className={buttonClass.quiet}>
            Start again
          </button>
        )}
        <button type="button" onClick={onCancel} className={buttonClass.text}>Cancel</button>
      </div>
    </div>
  );
}
