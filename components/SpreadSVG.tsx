"use client";

import { TAROT_DECK } from "@/lib/cards";
import { DEFAULT_POSITION_COLOR, hexToRgba } from "@/lib/position-colors";
import { styleRef } from "@/lib/apply-style";
import AppSigil from "@/components/ui/AppSigil";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
}

interface Props {
  cards: DrawnCard[];
  spreadName: string;
  openIndex: number | null;
  onToggle: (i: number) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const W = 96;    // card width
const H = 168;   // card height
const GAP = 24;  // horizontal gap between cards
const PAD = 20;  // padding around all cards

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cardBorderColor(isOpen: boolean, color: string) {
  if (isOpen) return color;
  return hexToRgba(color, 0.55);
}

// ─── Single card ──────────────────────────────────────────────────────────────
function SvgCard({
  card, idx, x, y, isOpen, onToggle,
}: {
  card: DrawnCard;
  idx: number;
  x: number;
  y: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const cx = x + W / 2;
  const cy = y + H / 2;
  const clipId = `ss-clip-${idx}`;
  const gradId = `ss-tap-${idx}`;
  const cardData = TAROT_DECK.find((c) => c.id === card.card_id);
  const fileName = cardData?.fileName ?? null;

  const posColor = card.color ?? DEFAULT_POSITION_COLOR;
  const stroke = cardBorderColor(isOpen, posColor);
  const sw = isOpen ? 2.5 : 1.5;
  const imgTransform = card.reversed ? `rotate(180, ${cx}, ${cy})` : undefined;

  const ariaLabel = `${card.position}: ${card.card_name || "Empty card slot"}${card.reversed ? " (Reversed)" : ""} — ${isOpen ? "hide" : "show"} details`;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={W} height={H} rx={6} ry={6} />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      <g
        onClick={onToggle}
        cursor="pointer"
        role="button"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
      >
        <rect
          x={x} y={y} width={W} height={H} rx={6} ry={6}
          fill="#12122a"
          stroke={stroke}
          strokeWidth={sw}
        />

        {fileName ? (
          <image
            href={`/cards/${fileName}`}
            x={x} y={y} width={W} height={H}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            transform={imgTransform}
          />
        ) : (
          <AppSigil x={cx - 13} y={cy - 13} size={26} className="text-tone-600" />
        )}

        {isOpen && (
          <rect
            x={x - 1} y={y - 1} width={W + 2} height={H + 2} rx={7} ry={7}
            fill="none" stroke={stroke} strokeWidth={1}
            ref={styleRef({ filter: `drop-shadow(0 0 8px ${hexToRgba(posColor, 0.6)})` })}
          />
        )}
      </g>

      {/* The hint sits outside the button so the button's name only holds the words it says (label in name). */}
      {!isOpen && fileName && (
        <g aria-hidden="true" pointerEvents="none">
            <rect
              x={x} y={y + H - 26} width={W} height={26}
              clipPath={`url(#${clipId})`}
              fill={`url(#${gradId})`}
            />
            <text
              x={cx} y={y + H - 8}
              textAnchor="middle" fill="#c4b5fd"
              fontSize={8} letterSpacing={2}
              pointerEvents="none"
            >TAP</text>
        </g>
      )}

      {/* Position label */}
      <text
        x={cx} y={y - 8}
        textAnchor="middle" fill={posColor}
        fontSize={8} letterSpacing={1.5}
        fontFamily="system-ui, sans-serif"
        pointerEvents="none" className="uppercase"
      >
        {card.position.toUpperCase()}
      </text>

      {/* Card name */}
      <text
        x={cx} y={y + H + 14}
        textAnchor="middle"
        className={isOpen ? "fill-ink" : "fill-ink-faint"}
        fontSize={9}
        fontFamily="system-ui, sans-serif"
        pointerEvents="none"
      >
        {card.card_name}
      </text>
      {card.reversed && (
        <text
          x={cx} y={y + H + 24}
          textAnchor="middle"
          className="fill-danger"
          fontSize={7}
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          reversed
        </text>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SpreadSVG({ cards, spreadName, openIndex, onToggle }: Props) {
  const n = cards.length;

  // Total SVG width: n cards + (n-1) gaps + 2 padding
  const totalW = n * W + (n - 1) * GAP + PAD * 2;
  // Total SVG height: label above + card + name below + padding
  const LABEL_H = 20;  // space above card for position label
  const NAME_H = 20;   // space below card for card name
  const totalH = LABEL_H + H + NAME_H + PAD * 2;

  const cardY = PAD + LABEL_H;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      className="block"
      // A group, not a picture: the cards inside are buttons, and a screen reader skips what is inside a picture.
      role="group"
      aria-label={`${spreadName} spread`}
    >
      {cards.map((card, i) => {
        const x = PAD + i * (W + GAP);
        return (
          <SvgCard
            key={i}
            card={card}
            idx={i}
            x={x}
            y={cardY}
            isOpen={openIndex === i}
            onToggle={() => onToggle(i)}
          />
        );
      })}
    </svg>
  );
}
