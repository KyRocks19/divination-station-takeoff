"use client";

import { CLOTH_SIZE, type Geom, type Zone } from "@/lib/cloth-core";
import type { Handle } from "@/lib/cloth-drag";

export interface Mark {
  x: number;
  y: number;
  /** A short label drawn beside the dot, for example the item's number. */
  text: string;
}

interface Props {
  zones: Zone[];
  marks?: Mark[];
  /** A sentence for a screen reader. The picture is a drawing of the zones listed beside it, which are the real controls. */
  label: string;
  className?: string;
  /** Tapping or clicking the cloth gives the place (0 to 1000). Pointer only: the lists and boxes beside it do the same by keyboard. */
  onPick?: (x: number, y: number) => void;
  /** Dots on one zone that a pointer can drag (the editor's "drag" extra). Hidden from a screen reader: the boxes beside the picture do the same. */
  handles?: Handle[];
  onHandleDrag?: (id: string, x: number, y: number) => void;
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)] as const;
};

function Shape({ g, color }: { g: Geom; color: string }) {
  const common = { fill: color, fillOpacity: 0.2, stroke: color, strokeWidth: 3 } as const;
  switch (g.shape) {
    case "circle":
      return <circle cx={g.cx} cy={g.cy} r={g.r} {...common} />;
    case "ring":
      return (
        <path
          d={`M ${g.cx - g.r} ${g.cy} a ${g.r} ${g.r} 0 1 0 ${2 * g.r} 0 a ${g.r} ${g.r} 0 1 0 ${-2 * g.r} 0 M ${g.cx - g.ri} ${g.cy} a ${g.ri} ${g.ri} 0 1 0 ${2 * g.ri} 0 a ${g.ri} ${g.ri} 0 1 0 ${-2 * g.ri} 0`}
          fillRule="evenodd"
          {...common}
        />
      );
    case "rectangle":
      return <rect x={g.x} y={g.y} width={g.w} height={g.h} {...common} />;
    case "half":
      return g.edge === "left" ? <rect x={0} y={0} width={g.at} height={CLOTH_SIZE} {...common} />
        : g.edge === "right" ? <rect x={CLOTH_SIZE - g.at} y={0} width={g.at} height={CLOTH_SIZE} {...common} />
        : g.edge === "top" ? <rect x={0} y={0} width={CLOTH_SIZE} height={g.at} {...common} />
        : <rect x={0} y={CLOTH_SIZE - g.at} width={CLOTH_SIZE} height={g.at} {...common} />;
    case "wedge": {
      const [x1, y1] = polar(g.cx, g.cy, g.r, g.start);
      const [x2, y2] = polar(g.cx, g.cy, g.r, g.start + g.sweep);
      return <path d={`M ${g.cx} ${g.cy} L ${x1} ${y1} A ${g.r} ${g.r} 0 ${g.sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} {...common} />;
    }
    case "freehand":
      return <polygon points={g.points.map((p) => p.join(",")).join(" ")} {...common} />;
  }
}

/** Where a zone's name is written: near the middle of what it covers. */
function labelPlace(g: Geom): [number, number] {
  switch (g.shape) {
    case "circle":
      return [g.cx, g.cy];
    case "ring":
      return [g.cx, g.cy - (g.r + g.ri) / 2];
    case "rectangle":
      return [g.x + g.w / 2, g.y + g.h / 2];
    case "half":
      return g.edge === "left" ? [g.at / 2, 40] : g.edge === "right" ? [CLOTH_SIZE - g.at / 2, 40] : g.edge === "top" ? [CLOTH_SIZE / 2, g.at / 2] : [CLOTH_SIZE / 2, CLOTH_SIZE - g.at / 2];
    case "wedge": {
      const [x, y] = polar(g.cx, g.cy, g.r * 0.6, g.start + g.sweep / 2);
      return [x, y];
    }
    case "freehand": {
      const n = g.points.length;
      return [g.points.reduce((s, p) => s + p[0], 0) / n, g.points.reduce((s, p) => s + p[1], 0) / n];
    }
  }
}

/**
 * A drawing of a cloth: the square, each zone in its own colour (the tone colour when it has none), the zone names, and dots where items landed.
 * It is a picture of what the lists and boxes beside it say. Nothing moves.
 */
export default function ClothPicture({ zones, marks = [], label, className = "", onPick, handles = [], onHandleDrag }: Props) {
  return (
    <svg
      viewBox={`${-MARGIN} ${-MARGIN} ${CLOTH_SIZE + 2 * MARGIN} ${CLOTH_SIZE + 2 * MARGIN}`}
      className={className}
      role="img"
      aria-label={label}
      onPointerDown={onPick ? (e) => pickInView(e, onPick) : undefined}
    >
      <rect x={0} y={0} width={CLOTH_SIZE} height={CLOTH_SIZE} className="fill-surface-sunken stroke-line-strong" strokeWidth={4} />
      {zones.map((z, i) => (
        <g key={`${i}-${z.name}`} className="text-tone-400">
          <Shape g={z.geom} color={z.color ?? "currentColor"} />
        </g>
      ))}
      {zones.map((z, i) => {
        const [x, y] = labelPlace(z.geom);
        return (
          <text key={`t${i}-${z.name}`} x={x} y={y} textAnchor="middle" fontSize={34} className="fill-ink-strong" stroke="none">
            {z.name.length > 18 ? `${z.name.slice(0, 17)}…` : z.name}
          </text>
        );
      })}
      {marks.map((m, i) => (
        <g key={`m${i}`}>
          <circle cx={m.x} cy={m.y} r={22} className="fill-blush stroke-canvas" strokeWidth={4} />
          <text x={m.x} y={m.y + 11} textAnchor="middle" fontSize={30} className="fill-canvas" fontWeight={700} stroke="none">
            {m.text}
          </text>
        </g>
      ))}
      {onHandleDrag && handles.length > 0 && (
        <g aria-hidden="true">
          {handles.map((h) => (
            <g
              key={h.id}
              className="touch-none cursor-grab"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                const svg = e.currentTarget.ownerSVGElement;
                if (!svg) return;
                const p = placeOf(svg, e.clientX, e.clientY);
                onHandleDrag(h.id, p.x, p.y);
              }}
            >
              <circle cx={h.x} cy={h.y} r={52} fill="transparent" />
              <circle cx={h.x} cy={h.y} r={26} className="fill-surface stroke-ink-strong" strokeWidth={6} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/** The space drawn around the cloth, in units, so an item that landed just off the edge can still be shown. */
export const MARGIN = 70;

/** A tap on the picture as a place on the cloth (0 to 1000 inside it; outside that is off the cloth, in the margin). */
function pickInView(e: React.PointerEvent<SVGSVGElement>, onPick: (x: number, y: number) => void) {
  const p = placeOf(e.currentTarget, e.clientX, e.clientY);
  onPick(p.x, p.y);
}

/** A pointer position as a place on the cloth. */
function placeOf(svg: SVGSVGElement, clientX: number, clientY: number) {
  const box = svg.getBoundingClientRect();
  const span = CLOTH_SIZE + 2 * MARGIN;
  return {
    x: Math.round(((clientX - box.left) / box.width) * span - MARGIN),
    y: Math.round(((clientY - box.top) / box.height) * span - MARGIN),
  };
}
