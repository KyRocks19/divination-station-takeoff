"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TAROT_DECK } from "@/lib/cards";
import { SUIT_META } from "@/lib/suit-meta";
import { DEFAULT_POSITION_COLOR } from "@/lib/position-colors";
import { styleRef } from "@/lib/apply-style";

type Polarity = "upright" | "reversed";

interface CardConcept {
  card_id: string;
  concepts: { id: number; name: string; display_name: string; reversed: boolean }[];
}

interface Props {
  cardConcepts: CardConcept[];
}

export default function CardWeb({ cardConcepts }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string>(cardConcepts[0]?.card_id ?? "");
  const [hoveredConceptId, setHoveredConceptId] = useState<number | null>(null);
  const [polarity, setPolarity] = useState<Polarity>("upright");

  const cardMap = useMemo(() => {
    const m = new Map<string, CardConcept>();
    for (const cc of cardConcepts) m.set(cc.card_id, cc);
    return m;
  }, [cardConcepts]);

  const selected = cardMap.get(selectedCardId);
  const card = TAROT_DECK.find((c) => c.id === selectedCardId);
  const suit = card?.suit ?? "major";

  const uprightColor = SUIT_META[suit]?.color ?? DEFAULT_POSITION_COLOR;
  // Reversed color: always rose, regardless of suit
  const reversedColor = "#e11d48";

  const color = polarity === "reversed" ? reversedColor : uprightColor;

  // Concepts filtered to current polarity
  const concepts = useMemo(
    () => (selected?.concepts ?? []).filter((c) => c.reversed === (polarity === "reversed")),
    [selected, polarity]
  );

  const spokeCount = concepts.length;

  // Cards that share the hovered concept at the same polarity
  const sharedCards = useMemo(() => {
    if (hoveredConceptId === null) return new Set<string>();
    const isRev = polarity === "reversed";
    const shared = new Set<string>();
    for (const cc of cardConcepts) {
      if (
        cc.card_id !== selectedCardId &&
        cc.concepts.some((c) => c.id === hoveredConceptId && c.reversed === isRev)
      ) {
        shared.add(cc.card_id);
      }
    }
    return shared;
  }, [hoveredConceptId, cardConcepts, selectedCardId, polarity]);

  // SVG spoke layout
  const cx = 200;
  const cy = 200;
  const innerR = 55;
  const outerR = 155;

  return (
    <div className="space-y-6">
      {/* Card selector + polarity toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs text-ink-faint uppercase tracking-widest">Card:</span>
        <select
          value={selectedCardId}
          onChange={(e) => { setSelectedCardId(e.target.value); setHoveredConceptId(null); }}
          className="bg-surface border border-line-strong text-ink-strong text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-focus"
        >
          {TAROT_DECK.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Polarity toggle */}
        <div className="flex rounded-lg overflow-hidden border border-line text-xs">
          <button
            onClick={() => { setPolarity("upright"); setHoveredConceptId(null); }}
            className={`px-3 py-1.5 transition-colors ${
              polarity === "upright"
                ? "bg-tone-900/50 text-tone-200"
                : "text-ink-faint hover:text-ink-soft bg-surface"
            }`}
          >
            Upright
          </button>
          <button
            onClick={() => { setPolarity("reversed"); setHoveredConceptId(null); }}
            className={`px-3 py-1.5 transition-colors border-l border-line ${
              polarity === "reversed"
                ? "bg-danger/25 text-danger-soft"
                : "text-ink-faint hover:text-ink-soft bg-surface"
            }`}
          >
            Reversed
          </button>
        </div>

        <span className="text-xs text-ink-ghost">
          {concepts.length} {polarity} concept{concepts.length !== 1 ? "s" : ""}
          {concepts.length === 0 && polarity === "reversed" && (
            <span className="ml-1 text-ink-ghost">(Major Arcana not in reversed seed)</span>
          )}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* SVG spoke diagram */}
        <div className="flex-shrink-0">
          <svg width="400" height="400" viewBox="0 0 400 400" className="max-w-full">
            {/* Subtle polarity ring behind center node */}
            {polarity === "reversed" && (
              <circle
                cx={cx} cy={cy} r={innerR + 6}
                fill="none"
                stroke="rgba(225,29,72,0.12)"
                strokeWidth="8"
              />
            )}

            {/* Center card node */}
            <circle
              cx={cx} cy={cy} r={innerR}
              fill={`${color}22`}
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray={polarity === "reversed" ? "4 3" : "none"}
            />
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              fontSize="11"
              fill={color}
              fontWeight="600"
            >
              {(card?.name?.length ?? 0) > 14
                ? (card?.name ?? "").slice(0, 12) + "…"
                : card?.name ?? ""}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="var(--color-ink-faint)">
              {polarity === "reversed" ? "reversed" : SUIT_META[suit]?.label}
            </text>

            {concepts.length === 0 ? (
              <text
                x={cx} y={cy + outerR}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(107,114,128,0.6)"
              >
                No {polarity} concepts
              </text>
            ) : (
              concepts.map((concept, i) => {
                const angle = (2 * Math.PI * i) / spokeCount - Math.PI / 2;
                const sx = cx + innerR * Math.cos(angle);
                const sy = cy + innerR * Math.sin(angle);
                const ex = cx + outerR * Math.cos(angle);
                const ey = cy + outerR * Math.sin(angle);
                const lx = cx + (outerR + 28) * Math.cos(angle);
                const ly = cy + (outerR + 28) * Math.sin(angle);
                const isHovered = hoveredConceptId === concept.id;

                return (
                  <g key={concept.id}>
                    <line
                      x1={sx} y1={sy} x2={ex} y2={ey}
                      stroke={isHovered ? color : `${color}44`}
                      strokeWidth={isHovered ? 1.5 : 0.8}
                      strokeDasharray={polarity === "reversed" ? "3 3" : "none"}
                    />
                    <circle
                      cx={ex} cy={ey} r={5}
                      fill={isHovered ? color : `${color}66`}
                      stroke={isHovered ? color : `${color}44`}
                      strokeWidth="1"
                      cursor="pointer"
                      onMouseEnter={() => setHoveredConceptId(concept.id)}
                      onMouseLeave={() => setHoveredConceptId(null)}
                    />
                    <text
                      x={lx} y={ly}
                      textAnchor={
                        Math.cos(angle) > 0.1 ? "start"
                        : Math.cos(angle) < -0.1 ? "end"
                        : "middle"
                      }
                      dominantBaseline="middle"
                      fontSize="8"
                      className={isHovered ? "fill-ink" : "fill-ink-faint"}
                      cursor="pointer"
                      onMouseEnter={() => setHoveredConceptId(concept.id)}
                      onMouseLeave={() => setHoveredConceptId(null)}
                    >
                      {concept.display_name.length > 18
                        ? concept.display_name.slice(0, 16) + "…"
                        : concept.display_name}
                    </text>
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Concept list + shared cards panel */}
        <div className="flex-1 space-y-4 min-w-0">
          {concepts.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-ink-faint uppercase tracking-widest">
                {polarity === "reversed" ? "Reversed concepts" : "Upright concepts"} ({concepts.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {concepts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                    className="text-xs px-2.5 py-0.5 rounded-full transition-colors"
                    ref={styleRef({
                      backgroundColor: hoveredConceptId === c.id ? `${color}44` : `${color}18`,
                      color: hoveredConceptId === c.id ? "var(--color-ink)" : color,
                    })}
                    onMouseEnter={() => setHoveredConceptId(c.id)}
                    onMouseLeave={() => setHoveredConceptId(null)}
                  >
                    {c.display_name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {hoveredConceptId !== null && sharedCards.size > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-ink-faint uppercase tracking-widest">
                {polarity === "reversed" ? "Also reversed in" : "Also in"} —{" "}
                {concepts.find((c) => c.id === hoveredConceptId)?.display_name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...sharedCards].map((cid) => {
                  const c = TAROT_DECK.find((t) => t.id === cid);
                  if (!c) return null;
                  const s = polarity === "reversed"
                    ? reversedColor
                    : (SUIT_META[c.suit]?.color ?? DEFAULT_POSITION_COLOR);
                  return (
                    <button
                      key={cid}
                      onClick={() => { setSelectedCardId(cid); setHoveredConceptId(null); }}
                      className="text-xs px-2.5 py-0.5 rounded-full transition-opacity hover:opacity-80"
                      ref={styleRef({ backgroundColor: `${s}22`, color: s })}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hoveredConceptId !== null && sharedCards.size === 0 && concepts.find((c) => c.id === hoveredConceptId) && (
            <p className="text-xs text-ink-ghost italic">
              No other cards share this {polarity} concept.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
