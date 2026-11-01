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
  openIndex: number | null;
  onToggle: (i: number) => void;
}

// ─── Layout constants ────────────────────────────────────────────────────────
const W = 96;   // card width in SVG units
const H = 168;  // card height in SVG units

// Top-left corner of each card slot. Index matches the Celtic Cross card order.
// Card 1 (Crossing) shares position with Card 0 and is rotated 90° around the centre.
// Cards 0/1/2/3/5 are shifted down relative to Card 4 so there's clear space
// between the Crown card's name text and the Heart/Crossing pair.
// Gap of exactly 78 SVG units between the Heart card's nearest edge and each
// surrounding card's nearest edge — one unit per tarot card in the deck.
//   Heart occupies x:228–324, y:316–484  (96×168, center 276,400)
//   Crown  bottom  = 316 − 78 = 238  →  y = 238 − 168 = 70
//   Root   top     = 484 + 78 = 562  →  y = 562
//   Past   right   = 228 − 78 = 150  →  x = 150 − 96  = 54
//   Future left    = 324 + 78 = 402  →  x = 402
const SLOTS: { x: number; y: number }[] = [
  { x: 228, y: 316 }, // 0  Heart of the Matter
  { x: 228, y: 316 }, // 1  Crossing It          (same slot, rotated)
  { x: 228, y: 562 }, // 2  Root
  { x:  54, y: 316 }, // 3  Past
  { x: 228, y:  70 }, // 4  Crown
  { x: 402, y: 316 }, // 5  Future
  { x: 592, y: 600 }, // 6  Self
  { x: 592, y: 404 }, // 7  Environment
  { x: 592, y: 210 }, // 8  Guidance
  { x: 592, y:  10 }, // 9  Outcome
];

// The Heart card's name sits above it, under its label, so the space below it is left to the crossing card.
const HEART_NAME_Y = SLOTS[0].y - 8;

// Short label and where to anchor it relative to the card
const LABELS: Record<number, { text: string; dx: number; dy: number; anchor: string }> = {
  4: { text: "Crown",   dx: W / 2,       dy: -10,      anchor: "middle" },
  2: { text: "Root",    dx: W / 2,       dy: H + 16,   anchor: "middle" },
  3: { text: "Past",    dx: W / 2,       dy: H + 16,   anchor: "middle" },
  5: { text: "Future",  dx: W / 2,       dy: H + 16,   anchor: "middle" },
  6: { text: "Self",    dx: -44,         dy: H / 2 + 4, anchor: "middle" },
  7: { text: "Environ.", dx: -44,        dy: H / 2 + 4, anchor: "middle" },
  8: { text: "Guidance", dx: -44,        dy: H / 2 + 4, anchor: "middle" },
  9: { text: "Outcome",  dx: -44,        dy: H / 2 + 4, anchor: "middle" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cardBorderColor(isOpen: boolean, color: string) {
  if (isOpen) return color;
  return hexToRgba(color, 0.55);
}

function strokeWidth(isOpen: boolean) {
  return isOpen ? 2.5 : 1.5;
}

// ─── Single card renderer ────────────────────────────────────────────────────
function SvgCard({
  card, idx, slot, isOpen, onToggle, crossing = false,
}: {
  card: DrawnCard;
  idx: number;
  slot: { x: number; y: number };
  isOpen: boolean;
  onToggle: () => void;
  crossing?: boolean;
}) {
  const { x, y } = slot;
  const cx = x + W / 2;
  const cy = y + H / 2;
  const clipId = `cc-clip-${idx}`;
  const gradId = `cc-tap-${idx}`;
  const cardData = TAROT_DECK.find((c) => c.id === card.card_id);
  const fileName = cardData?.fileName ?? null;

  const posColor = card.color ?? DEFAULT_POSITION_COLOR;
  const stroke = cardBorderColor(isOpen, posColor);
  const sw = strokeWidth(isOpen);

  // The whole <g> is rotated 90° for the crossing card
  const groupTransform = crossing ? `rotate(90, ${cx}, ${cy})` : undefined;

  // Reversed image spins 180° around the card centre
  const imgTransform = card.reversed ? `rotate(180, ${cx}, ${cy})` : undefined;

  const ariaLabel = `${card.card_name || "Empty card slot"}${card.reversed ? " (Reversed)" : ""}, ${card.position} — ${isOpen ? "hide" : "show"} details`;

  const label = LABELS[idx];

  return (
    <g>
      {/* Clip path so the card image has rounded corners */}
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={W} height={H} rx={6} ry={6} />
        </clipPath>
        {/* Gradient for the "TAP" fade at the bottom */}
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Clickable card group, optionally rotated */}
      <g
        transform={groupTransform}
        onClick={onToggle}
        cursor="pointer"
        role="button"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
      >
        {/* Card background */}
        <rect
          x={x} y={y} width={W} height={H} rx={6} ry={6}
          fill="#12122a"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Card image */}
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


        {/* Glow ring when open */}
        {isOpen && (
          <rect
            x={x - 1} y={y - 1} width={W + 2} height={H + 2} rx={7} ry={7}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            ref={styleRef({ filter: `drop-shadow(0 0 8px ${hexToRgba(posColor, 0.6)})` })}
          />
        )}
      </g>

      {/* The hint sits outside the button so the button's name only holds the words it says (label in name). */}
      {!isOpen && fileName && (
        <g transform={groupTransform} aria-hidden="true" pointerEvents="none">
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

      {/* Position label — rendered outside the rotated group so it stays upright */}
      {label && (
        <text
          x={x + label.dx}
          y={y + label.dy}
          textAnchor={label.anchor as any}
          fill={posColor}
          fontSize={9}
          letterSpacing={1.5}
          fontFamily="system-ui, sans-serif"
          pointerEvents="none" className="uppercase"
        >
          {label.text.toUpperCase()}
        </text>
      )}

      {/* Card name below (outside rotated group, always readable) */}
      {!crossing && (
        <>
          <text
            x={cx}
            y={idx === 0 ? HEART_NAME_Y - (card.reversed ? 10 : 0) : y + H + (label && label.dy > H ? 30 : 14)}
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
              x={cx}
              y={idx === 0 ? HEART_NAME_Y : y + H + (label && label.dy > H ? 40 : 24)}
              textAnchor="middle"
              className="fill-danger"
              fontSize={7}
              fontFamily="system-ui, sans-serif"
              pointerEvents="none"
            >
              reversed
            </text>
          )}
        </>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CelticCrossViewBox({ cards, openIndex, onToggle }: Props) {
  const crossingCenterX = SLOTS[0].x + W / 2;
  // The crossing block starts right under the Heart card, whose own name is above it
  const crossingLabelY = SLOTS[0].y + H + 16;
  const crossingPosColor = cards[1].color ?? DEFAULT_POSITION_COLOR;

  return (
    <svg
      viewBox="0 0 720 790"
      xmlns="http://www.w3.org/2000/svg"
      width={720}
      height={760}
      // A group, not a picture: the cards inside are buttons, and a screen reader skips what is inside a picture.
      role="group"
      aria-label="Celtic Cross ViewBox spread"
    >
      {/* Subtle divider between cross and staff */}
      <line
        x1={548} y1={20} x2={548} y2={740}
        className="stroke-line-strong" strokeWidth={1} strokeDasharray="4 6"
        pointerEvents="none"
      />
      <text
        x={560} y={6}
        className="fill-ink-faint" fontSize={8} letterSpacing={2}
        fontFamily="system-ui, sans-serif"
      >STAFF</text>

      {/* Heart card label, above its name */}
      <text
        x={276} y={HEART_NAME_Y - 12 - (cards[0].reversed ? 10 : 0)}
        textAnchor="middle"
        fill={cards[0].color ?? DEFAULT_POSITION_COLOR}
        fontSize={9} letterSpacing={1.5}
        fontFamily="system-ui, sans-serif"
        pointerEvents="none"
      >HEART</text>

      {/* Render non-centre cards first (z-order: behind) */}
      {[2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <SvgCard
          key={i}
          card={cards[i]}
          idx={i}
          slot={SLOTS[i]}
          isOpen={openIndex === i}
          onToggle={() => onToggle(i)}
        />
      ))}

      {/* Heart card (Card 0) — behind crossing */}
      <SvgCard
        card={cards[0]}
        idx={0}
        slot={SLOTS[0]}
        isOpen={openIndex === 0}
        onToggle={() => onToggle(0)}
      />

      {/* Crossing card (Card 1) — on top, rotated 90° */}
      <SvgCard
        card={cards[1]}
        idx={1}
        slot={SLOTS[1]}
        isOpen={openIndex === 1}
        onToggle={() => onToggle(1)}
        crossing
      />

      {/* Crossing card label + name below Heart card name */}
      <text
        x={crossingCenterX}
        y={crossingLabelY}
        textAnchor="middle"
        fill={crossingPosColor}
        fontSize={9}
        letterSpacing={1.5}
        fontFamily="system-ui, sans-serif"
        pointerEvents="none" className="uppercase"
      >
        CROSSING
      </text>
      <text
        x={crossingCenterX}
        y={crossingLabelY + 12}
        textAnchor="middle"
        className={openIndex === 1 ? "fill-ink" : "fill-ink-faint"}
        fontSize={9}
        fontFamily="system-ui, sans-serif"
        pointerEvents="none"
      >
        {cards[1].card_name}
      </text>
      {cards[1].reversed && (
        <text
          x={crossingCenterX}
          y={crossingLabelY + 22}
          textAnchor="middle"
          className="fill-danger"
          fontSize={7}
          fontFamily="system-ui, sans-serif"
          pointerEvents="none"
        >
          reversed
        </text>
      )}
    </svg>
  );
}
