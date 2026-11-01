"use client";

import { SUIT_META, type SuitDist } from "@/lib/suit-meta";
export { SUIT_META, type SuitDist };

interface Props {
  distribution: SuitDist[];
  size?: number;
  /** Names and colours of the groups when they are not the tarot suits (the key is the group's id in `distribution`). */
  meta?: Record<string, { label: string; color: string }>;
  /** What the ring says to a screen reader. */
  label?: string;
  /** What each segment counts, in its tooltip: "draw" for tarot. */
  unit?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
  gap = 2,
): string {
  const s = startDeg + gap / 2;
  const e = endDeg - gap / 2;
  if (e <= s) return "";
  const o1 = polarToCartesian(cx, cy, outerR, s);
  const o2 = polarToCartesian(cx, cy, outerR, e);
  const i1 = polarToCartesian(cx, cy, innerR, e);
  const i2 = polarToCartesian(cx, cy, innerR, s);
  const large = e - s > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    `Z`,
  ].join(" ");
}

export default function SuitRing({ distribution, size = 160, meta: groupMeta, label = "Suit distribution ring chart", unit = "draw" }: Props) {
  const cx = 50;
  const cy = 50;
  const outerR = 44;
  const innerR = 27;

  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  let startAngle = 0;
  const segments = distribution
    .filter((d) => d.count > 0)
    .map((d) => {
      const sweep = (d.count / total) * 360;
      const seg = { ...d, startAngle, sweep };
      startAngle += sweep;
      return seg;
    });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={label}
    >
      {segments.map((seg) => {
        const meta = groupMeta?.[seg.suit] ?? SUIT_META[seg.suit] ?? { label: seg.suit, color: "#6b7280" };
        const d = arcPath(cx, cy, outerR, innerR, seg.startAngle, seg.startAngle + seg.sweep);
        if (!d) return null;
        return (
          <path key={seg.suit} d={d} fill={meta.color} opacity={0.9}>
            {/* One string: React does not accept several pieces of text inside <title>. */}
            <title>{`${meta.label}: ${seg.count} ${unit}${seg.count !== 1 ? "s" : ""} (${Math.round(seg.percentage)}%)`}</title>
          </path>
        );
      })}
    </svg>
  );
}
