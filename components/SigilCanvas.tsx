"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { applyStyle, styleRef } from "@/lib/apply-style";
import { SigilMark } from "@/components/ui/AppSigil";

interface SigilCanvasProps {
  /** Called with a PNG data URL when the user saves, or null when cleared */
  onSave: (data: string | null) => void;
  /** Existing sigil to show on mount */
  initialData?: string | null;
  /** Canvas display size in px (square). Default 200. */
  size?: number;
}

export default function SigilCanvas({ onSave, initialData, size = 200 }: SigilCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing sigil on mount
  useEffect(() => {
    if (!initialData || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      setHasStrokes(true);
    };
    img.src = initialData;
  }, [initialData]);

  function getPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function setupCtx(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "#c084fc"; // purple-400 to match theme
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
  }

  const startDraw = useCallback((pos: { x: number; y: number }) => {
    drawing.current = true;
    lastPoint.current = pos;
    setSaved(false);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setupCtx(ctx);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#c084fc";
    ctx.fill();
  }, []);

  const continueDraw = useCallback((pos: { x: number; y: number }) => {
    if (!drawing.current || !lastPoint.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    setupCtx(ctx);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
    setHasStrokes(true);
  }, []);

  const endDraw = useCallback(() => {
    drawing.current = false;
    lastPoint.current = null;
  }, []);

  // Mouse handlers
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    startDraw(getPos(e.nativeEvent, e.currentTarget));
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    continueDraw(getPos(e.nativeEvent, e.currentTarget));
  }
  function onMouseUp() { endDraw(); }
  function onMouseLeave() { endDraw(); }

  // Touch handlers
  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const t = e.touches[0];
    startDraw(getPos(t, e.currentTarget));
  }
  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const t = e.touches[0];
    continueDraw(getPos(t, e.currentTarget));
  }
  function onTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    endDraw();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    setSaved(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    setSaving(true);
    const data = canvas.toDataURL("image/png");
    await onSave(data);
    setSaving(false);
    setSaved(true);
  }

  async function clearSigil() {
    clear();
    await onSave(null);
  }

  return (
    <div className="space-y-3">
      <div
        className="relative inline-block rounded-xl overflow-hidden border border-line-accent [background:radial-gradient(ellipse_at_center,#1a0a2e_0%,#0d0d1a_100%)]"
      >
        {/* Faint crosshair guide */}
        <svg
          className="absolute inset-0 pointer-events-none opacity-10"
          width={size}
          height={size}
          aria-hidden="true"
        >
          <line x1={size / 2} y1="10" x2={size / 2} y2={size - 10} stroke="#7c3aed" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="10" y1={size / 2} x2={size - 10} y2={size / 2} stroke="#7c3aed" strokeWidth="0.5" strokeDasharray="3 3" />
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 12} stroke="#7c3aed" strokeWidth="0.5" strokeDasharray="3 3" fill="none" />
        </svg>

        <canvas
          ref={(el) => {
            canvasRef.current = el;
            if (el) applyStyle(el, { width: size, height: size });
          }}
          width={size}
          height={size}
          className="cursor-crosshair touch-none block"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          role="img"
          aria-label="Sigil drawing canvas. Draw with a finger, a pen or a mouse. A sigil is optional; the rest of the app works without one."
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={!hasStrokes || saving}
          className="text-sm bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas font-medium px-4 py-1.5 min-h-11 sm:min-h-0 rounded-lg transition-colors"
        >
          {saving ? "Sealing…" : saved ? <>Sealed <SigilMark /></> : "Seal Sigil"}
        </button>
        <button
          onClick={clear}
          disabled={!hasStrokes}
          className="text-sm text-ink-faint hover:text-ink-soft disabled:opacity-30 border border-line-strong px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg transition-colors"
        >
          Clear
        </button>
        {initialData && (
          <button
            onClick={clearSigil}
            className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-danger hover:text-danger transition-colors ml-auto"
          >
            Remove sigil
          </button>
        )}
      </div>
      <p className="text-xs text-ink-ghost">Draw with mouse or finger. Your sigil will seal every reading and forum post.</p>
    </div>
  );
}
