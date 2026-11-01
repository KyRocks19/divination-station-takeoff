"use client";

import { TAROT_DECK } from "@/lib/cards";
import { DEFAULT_POSITION_COLOR, hexToRgba } from "@/lib/position-colors";
import { BOARD_CARD_H as H, BOARD_CARD_W as W, wrapLabel } from "@/lib/layouts-shared";
import { styleRef } from "@/lib/apply-style";
import AppSigil from "@/components/ui/AppSigil";

export interface BoardCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
  /** Where the card sits on the board, in board units, and how far it is turned. */
  x: number;
  y: number;
  rotation?: number | null;
}

interface Props {
  cards: BoardCard[];
  layoutName: string;
  openIndex: number | null;
  onToggle: (i: number) => void;
}

const MARGIN = 28;
const LABEL_ROOM = 34; // above a card: one or two lines of the position's name
const NAME_ROOM = 40; // below a card: its name, "reversed", and a stacked label

/** The box a card fills once it is turned: sideways cards swap width and height. */
function extent(c: BoardCard) {
  const sideways = ((((c.rotation ?? 0) % 180) + 180) % 180) === 90;
  return { w: sideways ? H : W, h: sideways ? W : H, cx: c.x + W / 2, cy: c.y + H / 2 };
}

/**
 * Shows drawn cards where the layout put them on a board (a Celtic Cross, a cross, a grid, a circle). A card turned
 * across another one at the same spot has its label and name stacked under the card it lies on, so nothing is hidden;
 * the card it lies on has its name above it, under its label.
 */
export default function LayoutBoard({ cards, layoutName, openIndex, onToggle }: Props) {
  const boxes = cards.map(extent);

  // A card lying on an earlier one (same centre) shares that card's text block.
  const under = cards.map((_, i) => {
    for (let j = 0; j < i; j++) {
      if (Math.abs(boxes[j].cx - boxes[i].cx) < 12 && Math.abs(boxes[j].cy - boxes[i].cy) < 12) return j;
    }
    return -1;
  });
  // A card with another lying across it (Heart of the Matter) has its name above it, under its label, so the space
  // below it is left to the card on top.
  const covered = cards.map((_, i) => under.includes(i));
  const nameAbove = (i: number) => (covered[i] ? 12 + (cards[i].reversed ? 10 : 0) : 0);

  const minX = Math.min(...boxes.map((b) => b.cx - b.w / 2)) - MARGIN;
  const maxX = Math.max(...boxes.map((b) => b.cx + b.w / 2)) + MARGIN;
  const minY = Math.min(...boxes.map((b, i) => b.cy - b.h / 2 - nameAbove(i))) - LABEL_ROOM;
  const maxY = Math.max(...boxes.map((b) => b.cy + b.h / 2)) + NAME_ROOM;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      className="block"
      ref={styleRef({ maxWidth: vbW })}
      // A group, not a picture: the cards inside are buttons, and a screen reader skips what is inside a picture.
      role="group"
      aria-label={`${layoutName} layout`}
    >
      {cards.map((card, i) => {
        const b = boxes[i];
        const isOpen = openIndex === i;
        const cardData = TAROT_DECK.find((c) => c.id === card.card_id);
        const fileName = cardData?.fileName ?? null;
        const color = card.color ?? DEFAULT_POSITION_COLOR;
        const stroke = isOpen ? color : hexToRgba(color, 0.55);
        const clipId = `lb-clip-${i}`;
        const gradId = `lb-tap-${i}`;
        const rot = card.rotation ?? 0;
        const imgTransform = card.reversed ? `rotate(180, ${b.cx}, ${b.cy})` : undefined;
        const ariaLabel = `${card.position}: ${card.card_name || "Empty card slot"}${card.reversed ? " (Reversed)" : ""} — ${isOpen ? "hide" : "show"} details`;
        const lines = wrapLabel(card.position);
        const lower = under[i] >= 0;
        // The text block sits over the card, or (for a card lying on another) under that other card's block.
        const hostBox = lower ? boxes[under[i]] : b;
        const hostBottom = hostBox.cy + hostBox.h / 2;
        // The card underneath has its name above it, so the stacked block starts right under it.
        const stackedExtra = lower ? 2 : 0;
        const textX = lower ? hostBox.cx : b.cx;
        const top = b.cy - b.h / 2;
        const nameY = lower
          ? hostBottom + stackedExtra + 24
          : covered[i]
            ? top - 8 - (card.reversed ? 10 : 0)
            : b.cy + b.h / 2 + 14;
        const labelBottom = covered[i] ? nameY - 12 : top - 8;
        return (
          <g key={i}>
            <defs>
              <clipPath id={clipId}>
                <rect x={card.x} y={card.y} width={W} height={H} rx={6} ry={6} />
              </clipPath>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
              </linearGradient>
            </defs>

            <g
              transform={rot ? `rotate(${rot}, ${b.cx}, ${b.cy})` : undefined}
              onClick={() => onToggle(i)}
              cursor="pointer"
              role="button"
              aria-label={ariaLabel}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onToggle(i);
              }}
            >
              <rect x={card.x} y={card.y} width={W} height={H} rx={6} ry={6} fill="#12122a" stroke={stroke} strokeWidth={isOpen ? 2.5 : 1.5} />
              {fileName ? (
                <image
                  href={`/cards/${fileName}`}
                  x={card.x}
                  y={card.y}
                  width={W}
                  height={H}
                  clipPath={`url(#${clipId})`}
                  preserveAspectRatio="xMidYMid slice"
                  transform={imgTransform}
                />
              ) : (
                <AppSigil x={b.cx - 13} y={b.cy - 13} size={26} className="text-tone-600" />
              )}
              {!isOpen && fileName && (
                <>
                  <rect x={card.x} y={card.y + H - 26} width={W} height={26} clipPath={`url(#${clipId})`} fill={`url(#${gradId})`} />
                  <text x={b.cx} y={card.y + H - 8} textAnchor="middle" fill="#c4b5fd" fontSize={8} letterSpacing={2} pointerEvents="none">
                    TAP
                  </text>
                </>
              )}
              {isOpen && (
                <rect
                  x={card.x - 1}
                  y={card.y - 1}
                  width={W + 2}
                  height={H + 2}
                  rx={7}
                  ry={7}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1}
                  ref={styleRef({ filter: `drop-shadow(0 0 8px ${hexToRgba(color, 0.6)})` })}
                />
              )}
            </g>

            {/* Text stays upright, outside the turned group. */}
            {lower ? (
              <text
                x={textX}
                y={hostBottom + stackedExtra + 12}
                textAnchor="middle"
                fill={color}
                fontSize={8}
                letterSpacing={1.5}
                fontFamily="system-ui, sans-serif"
                pointerEvents="none"
              >
                {lines.join(" ")}
              </text>
            ) : (
              lines.map((line, k) => (
                <text
                  key={k}
                  x={b.cx}
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
              x={textX}
              y={nameY}
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
                x={textX}
                y={nameY + 10}
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
      })}
    </svg>
  );
}
