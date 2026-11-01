"use client";

import { useState, useId, useRef } from "react";
import { TAROT_DECK } from "@/lib/cards";
import { DEFAULT_POSITION_COLOR, hexToRgba } from "@/lib/position-colors";
import { styleRef } from "@/lib/apply-style";
import { SigilMark } from "@/components/ui/AppSigil";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
}

interface Props {
  cards: DrawnCard[];
  clarifiers: Record<number, DrawnCard[]>;
  openIndex: number | null;
  onSelectCard: (cardIndex: number) => void;
  onDrawClarifier?: () => void;
  drawingClarifier?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function positionKeyword(name: string): string {
  return name.split(" ")[0];
}

// ─── Mini card ────────────────────────────────────────────────────────────────
function MiniCard({
  card,
  ariaLabel,
  onClick,
  color,
}: {
  card: DrawnCard;
  ariaLabel: string;
  onClick: () => void;
  color: string;
}) {
  const cardData = TAROT_DECK.find((c) => c.id === card.card_id);
  const fileName = cardData?.fileName ?? null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="group flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
      >
        <div
          className="relative overflow-hidden rounded-md transition-all w-[58px] h-[101px]"
          ref={styleRef({ border: `1.5px solid ${hexToRgba(color, 0.5)}` })}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = color;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = hexToRgba(color, 0.5);
          }}
        >
          {fileName ? (
            <img
              src={`/cards/${fileName}`}
              alt=""
              aria-hidden="true"
              className={`w-full h-full object-cover ${card.reversed ? "[transform:rotate(180deg)]" : ""}`}
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-full h-full flex items-center justify-center bg-surface text-lg"
              ref={styleRef({ color: hexToRgba(color, 0.6) })}
            >
              <SigilMark />
            </div>
          )}
        </div>

        <span
          aria-hidden="true"
          className="text-[9px] text-ink-faint text-center leading-tight group-hover:text-ink-soft group-focus-visible:text-ink-soft transition-colors max-w-[58px]"
        >
          {card.card_name}
        </span>
        {card.reversed && (
          <span
            aria-hidden="true"
            className="text-[7px] text-danger text-center leading-none"
          >
            reversed
          </span>
        )}

        <span
          aria-hidden="true"
          className="text-[8px] uppercase tracking-wider"
          ref={styleRef({ color: hexToRgba(color, 0.6) })}
        >
          {card.position}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClarifierDrawer({
  cards,
  clarifiers,
  openIndex,
  onSelectCard,
  onDrawClarifier,
  drawingClarifier = false,
}: Props) {
  const uid = useId();
  const [collapsed, setCollapsed] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  const groupIndices = Object.keys(clarifiers)
    .map(Number)
    .filter((i) => clarifiers[i]?.length > 0)
    .sort((a, b) => a - b);

  if (groupIndices.length === 0 && openIndex === null) return null;

  // No clarifiers yet but a card is selected — show just the draw button
  if (groupIndices.length === 0) {
    return (
      <section aria-label="Clarifier cards">
        {onDrawClarifier && openIndex !== null && (
          <button
            onClick={onDrawClarifier}
            disabled={drawingClarifier}
            className="w-full text-xs border border-line-strong hover:border-line-hover disabled:opacity-50 text-tone-400 hover:text-tone-300 font-medium py-2 px-3 rounded-lg transition-colors"
          >
            {drawingClarifier ? "Drawing…" : <><SigilMark /> Draw a clarifier</>}
          </button>
        )}
      </section>
    );
  }

  const panelId = `${uid}-clarifier-panel`;
  const toggleId = `${uid}-clarifier-toggle`;

  function handleSelectCard(cardIndex: number) {
    onSelectCard(cardIndex);
    const parentCard = cards[cardIndex];
    if (liveRef.current) {
      liveRef.current.textContent = `${parentCard.position} card details open`;
    }
  }

  return (
    <section aria-label="Clarifier cards">
      {/* sr-only live region */}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* Draw button — always at top when a card is selected */}
      {onDrawClarifier && openIndex !== null && (
        <button
          onClick={onDrawClarifier}
          disabled={drawingClarifier}
          className="w-full text-xs border border-line-strong hover:border-line-hover disabled:opacity-50 text-tone-400 hover:text-tone-300 font-medium py-2 px-3 rounded-lg transition-colors mb-3"
        >
          {drawingClarifier ? "Drawing…" : <><SigilMark /> Draw a clarifier</>}
        </button>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-tone-500 uppercase tracking-widest">
          <SigilMark /> Clarifiers
        </p>
        <button
          id={toggleId}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-ink-ghost hover:text-tone-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tone-500 rounded px-1"
        >
          {collapsed ? "Show ▾" : "Hide ▴"}
        </button>
      </div>

      {/* Collapsible panel */}
      <div
        id={panelId}
        aria-hidden={collapsed}
        className={`overflow-hidden transition-all duration-200 ${
          collapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
        }`}
      >
        <div className="flex flex-wrap gap-3">
          {groupIndices.map((cardIndex) => {
            const parentCard = cards[cardIndex];
            const keyword = positionKeyword(parentCard.position);
            const groupClarifiers = clarifiers[cardIndex];
            const isActive = openIndex === cardIndex;
            const posColor = parentCard.color ?? DEFAULT_POSITION_COLOR;

            return (
              <section
                key={cardIndex}
                aria-label={`Clarifiers for ${parentCard.position}`}
                aria-current={isActive ? "true" : undefined}
                className="rounded-xl p-3 transition-all duration-150"
                ref={styleRef({
                  background: isActive
                    ? hexToRgba(posColor, 0.08)
                    : hexToRgba(posColor, 0.04),
                  border: `1px solid ${isActive ? posColor : hexToRgba(posColor, 0.3)}`,
                  boxShadow: isActive
                    ? `0 0 0 1px ${hexToRgba(posColor, 0.3)}`
                    : "none",
                })}
              >
                <p
                  className="text-[9px] uppercase tracking-widest mb-3 font-medium"
                  ref={styleRef({ color: isActive ? posColor : hexToRgba(posColor, 0.5) })}
                >
                  {keyword}
                </p>

                <div className="flex flex-row gap-3">
                  {groupClarifiers.map((clarifierCard, ci) => (
                    <MiniCard
                      key={ci}
                      card={clarifierCard}
                      color={posColor}
                      ariaLabel={`${clarifierCard.card_name}${clarifierCard.reversed ? " reversed" : ""}, Clarifier ${ci + 1} for ${parentCard.position} — tap to open position details`}
                      onClick={() => handleSelectCard(cardIndex)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

    </section>
  );
}
