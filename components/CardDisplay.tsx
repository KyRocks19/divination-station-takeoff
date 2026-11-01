"use client";

import FillImage from "@/components/ui/FillImage";
import { useState } from "react";
import { styleRef } from "@/lib/apply-style";
import { cardIdToFileName } from "@/lib/card-image";
import { SigilMark } from "@/components/ui/AppSigil";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
}

interface Props {
  card: DrawnCard;
  compact?: boolean;
  crossing?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  clarifiers?: DrawnCard[];
  onClarifierClick?: (ci: number) => void;
}

export default function CardDisplay({ card, compact, crossing, isOpen, onToggle, clarifiers, onClarifierClick }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = isOpen !== undefined ? isOpen : internalOpen;
  function toggle() {
    if (onToggle) onToggle();
    else setInternalOpen((o) => !o);
  }

  const fileName = card.card_id ? cardIdToFileName(card.card_id) : null;

  const borderClass = crossing
    ? card.reversed ? "border-danger/50" : "border-warning/60"
    : card.reversed ? "border-danger/50" : "border-line-accent";

  const openBorderClass = crossing
    ? "border-warning-ink shadow-amber-900/40"
    : card.reversed ? "border-danger" : "border-tone-500";

  const hoverClass = crossing ? "hover:border-warning" : "hover:border-line-hover";

  const cardLabel = card.card_name
    ? `${card.card_name}${card.reversed ? " (Reversed)" : ""}${card.position ? `, ${card.position}` : ""} — ${open ? "hide" : "show"} details`
    : `Empty card slot${card.position ? `, ${card.position}` : ""}`;

  return (
    <div className={`flex flex-col items-center gap-2 ${crossing ? "w-24" : compact ? "w-24" : "w-36"}`}>
      {card.position && !crossing && (
        <span className="text-xs text-tone-400 uppercase tracking-widest text-center">
          {card.position}
        </span>
      )}

      {crossing ? (
        <div className="relative w-[168px] h-[96px]">
          <button
            onClick={toggle}
            aria-label={cardLabel}
            aria-expanded={open}
            className={`absolute rounded-lg overflow-hidden border-2 transition-all shadow-lg shadow-tone-900/30 cursor-pointer w-24 h-[168px] -top-9 left-9 [transform:rotate(90deg)] origin-center ${borderClass} ${hoverClass} ${open ? openBorderClass : ""}`}
          >
            {fileName ? (
              <FillImage src={`/cards/${fileName}`} alt={card.card_name} className="object-cover" sizes="96px" />
            ) : (
              <div className="w-full h-full bg-tone-900/30 flex items-center justify-center">
                <SigilMark className="text-tone-400 text-4xl" />
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={toggle}
            aria-label={cardLabel}
            aria-expanded={open}
            className={`relative rounded-lg overflow-hidden border-2 transition-all shadow-lg shadow-tone-900/30 cursor-pointer ${compact ? "w-24 h-[168px]" : "w-36 h-[252px]"} ${borderClass} ${hoverClass} ${open ? openBorderClass : ""}`}
          >
            {fileName ? (
              <FillImage
                src={`/cards/${fileName}`}
                alt={card.card_name}
                className={`object-cover transition-all ${card.reversed ? "rotate-180" : ""}`}
                sizes="(max-width: 768px) 96px, 144px"
              />
            ) : (
              <div className="w-full h-full bg-tone-900/30 flex items-center justify-center">
                <SigilMark className="text-tone-400 text-4xl" />
              </div>
            )}
            {!open && (
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent py-1.5 flex justify-center">
                <span className="text-[10px] text-tone-300 tracking-widest">TAP</span>
              </div>
            )}
          </button>
          {clarifiers?.map((c, ci) => {
            const cFile = c.card_id ? cardIdToFileName(c.card_id) : null;
            return (
              <button
                key={ci}
                onClick={() => onClarifierClick?.(ci)}
                aria-label={`Clarifier card: ${c.card_name}${c.reversed ? " (Reversed)" : ""} — show details`}
                className={`absolute rounded-md overflow-hidden border-2 border-line-accent hover:border-tone-400 transition-all shadow-lg shadow-tone-900/40 cursor-pointer z-10 ${compact ? "w-12 h-[84px]" : "w-[72px] h-[126px]"}`}
                ref={styleRef({ bottom: -12 + ci * -6, right: -12 + ci * -6 })}
              >
                {cFile ? (
                  <FillImage
                    src={`/cards/${cFile}`}
                    alt={c.card_name}
                    className={`object-cover ${c.reversed ? "rotate-180" : ""}`}
                    sizes={compact ? "48px" : "72px"}
                  />
                ) : (
                  <div className="w-full h-full bg-tone-900/30 flex items-center justify-center">
                    <SigilMark className="text-tone-400 text-xl" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-ink-strong">{card.card_name}</p>
        {card.reversed && <p className="text-xs text-danger-ink">Reversed</p>}
      </div>
    </div>
  );
}
