"use client";

import { useId, useRef, useState } from "react";
import { BOARD_CARD_H as H, BOARD_CARD_W as W, BOARD_STEP, GRID_STEP_X, GRID_STEP_Y, snapToStep, wrapLabel } from "@/lib/layouts-shared";
import { applyStyle, styleRef } from "@/lib/apply-style";

export interface BoardPosition {
  name: string;
  color: string;
  x: number | null;
  y: number | null;
  rotation: number | null;
}

interface Props {
  positions: BoardPosition[];
  onMove: (index: number, x: number, y: number) => void;
  /** With the grid on, cards snap to steps a quarter of a card wide and a quarter of a card tall, and the grid is drawn. */
  grid: boolean;
}

/** Room above the board's top edge for the name of a position placed at the very top. */
const LABEL_ROOM = 46;

/**
 * The board a layout is placed on. Each position is a card-sized box: drag it with the pointer, or focus it and use
 * the arrow keys (Shift moves it further). It snaps to a small step, or to the grid when the grid is on. Turning a
 * position is done in its own row. Each box carries the same text a finished reading shows on its board (the
 * position's name above the card, the card's name below it), with a stand-in where the card's name will be.
 */
export default function BoardEditor({ positions, onMove, grid }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ i: number; dx: number; dy: number } | null>(null);
  const patternId = `board-grid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const snapX = (n: number) => snapToStep(n, grid ? GRID_STEP_X : BOARD_STEP);
  const snapY = (n: number) => snapToStep(n, grid ? GRID_STEP_Y : BOARD_STEP);

  const placed = positions.map((p) => {
    const x = p.x ?? 0;
    const y = p.y ?? 0;
    const sideways = p.rotation === 90 || p.rotation === 270;
    // The box the card fills once turned: a sideways card swaps width and height around the same centre.
    return { x, y, sideways, cx: x + W / 2, cy: y + H / 2, h: sideways ? W : H };
  });
  const maxX = Math.max(720, ...placed.map((p) => p.x + W + 60));
  const maxY = Math.max(520, ...placed.map((p) => p.y + H + 60));

  // As on a reading's board: a card lying on an earlier one (same centre) puts its text under that card's text.
  const under = placed.map((b, i) => {
    for (let j = 0; j < i; j++) {
      if (Math.abs(placed[j].cx - b.cx) < 12 && Math.abs(placed[j].cy - b.cy) < 12) return j;
    }
    return -1;
  });

  function toBoard(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  return (
    <svg
      ref={(el) => {
        svgRef.current = el;
        if (el) applyStyle(el, { maxWidth: maxX });
      }}
      viewBox={`0 ${-LABEL_ROOM} ${maxX} ${maxY + LABEL_ROOM}`}
      width="100%"
      className="bg-surface-sunken border border-line rounded-card touch-none select-none block"
      role="group"
      aria-label={`Board: drag each position, or focus it and use the arrow keys${grid ? ". Cards snap to a grid a quarter of a card apart" : ""}`}
    >
      {grid && (
        <>
          <defs>
            <pattern id={patternId} width={GRID_STEP_X} height={GRID_STEP_Y} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_STEP_X} 0 L 0 0 0 ${GRID_STEP_Y}`} fill="none" className="stroke-line" strokeWidth={1} />
            </pattern>
          </defs>
          <rect x={0} y={-LABEL_ROOM} width={maxX} height={maxY + LABEL_ROOM} fill={`url(#${patternId})`} pointerEvents="none" aria-hidden="true" />
        </>
      )}
      {positions.map((p, i) => {
        const { x, y, sideways, cx, cy, h } = placed[i];
        const color = p.color || "#94a3b8";
        const lines = wrapLabel(p.name.trim() || `Position ${i + 1}`);
        const lower = under[i] >= 0;
        const host = lower ? placed[under[i]] : placed[i];
        const hostBottom = host.cy + host.h / 2;
        // As on a reading's board: a card with another lying across it has its name above it, under its label.
        const covered = under.includes(i);
        const nameY = lower ? hostBottom + 26 : covered ? cy - h / 2 - 8 : cy + h / 2 + 14;
        const labelBottom = covered ? nameY - 12 : cy - h / 2 - 8;
        return (
          <g key={i}>
            <g
              transform={sideways ? `rotate(90, ${cx}, ${cy})` : undefined}
              tabIndex={0}
              role="button"
              aria-label={`Position ${i + 1}, ${p.name || "unnamed"}, at ${x}, ${y}${sideways ? ", turned sideways" : ""}`}
              className="outline-none"
              ref={styleRef({ cursor: dragging?.i === i ? "grabbing" : "grab" })}
              onPointerDown={(e) => {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                const at = toBoard(e);
                setDragging({ i, dx: at.x - x, dy: at.y - y });
              }}
              onPointerMove={(e) => {
                if (!dragging || dragging.i !== i) return;
                const at = toBoard(e);
                const nx = snapX(at.x - dragging.dx);
                const ny = snapY(at.y - dragging.dy);
                if (nx !== x || ny !== y) onMove(i, nx, ny);
              }}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              onKeyDown={(e) => {
                // On the grid one press is one grid step and Shift is a whole card; off it, the old small and large steps.
                const sx = grid ? (e.shiftKey ? W : GRID_STEP_X) : e.shiftKey ? 48 : 12;
                const sy = grid ? (e.shiftKey ? H : GRID_STEP_Y) : e.shiftKey ? 48 : 12;
                const moves: Record<string, [number, number]> = { ArrowLeft: [-sx, 0], ArrowRight: [sx, 0], ArrowUp: [0, -sy], ArrowDown: [0, sy] };
                const d = moves[e.key];
                if (!d) return;
                e.preventDefault();
                onMove(i, snapX(x + d[0]), snapY(y + d[1]));
              }}
            >
              <rect x={x} y={y} width={W} height={H} rx={6} fill="rgba(18,18,42,0.85)" stroke={color} strokeWidth={dragging?.i === i ? 3 : 1.5} />
              <text x={cx} y={cy + 9} textAnchor="middle" fill={color} fontSize={26} fontWeight="bold" pointerEvents="none">
                {i + 1}
              </text>
            </g>

            {/* The text a finished reading shows, upright and outside the turned group. */}
            {lower ? (
              <text x={host.cx} y={hostBottom + 14} textAnchor="middle" fill={color} fontSize={8} letterSpacing={1.5} fontFamily="system-ui, sans-serif" pointerEvents="none">
                {lines.join(" ")}
              </text>
            ) : (
              lines.map((line, k) => (
                <text
                  key={k}
                  x={cx}
                  y={labelBottom - (lines.length - 1 - k) * 11}
                  textAnchor="middle"
                  fill={color}
                  fontSize={8}
                  letterSpacing={1.5}
                  fontFamily="system-ui, sans-serif"
                  pointerEvents="none"
                >
                  {line}
                </text>
              ))
            )}
            <text
              x={lower ? host.cx : cx}
              y={nameY}
              textAnchor="middle"
              className="fill-ink-faint"
              fontSize={9}
              fontStyle="italic"
              fontFamily="system-ui, sans-serif"
              pointerEvents="none"
            >
              Card drawn here
            </text>
          </g>
        );
      })}
    </svg>
  );
}
