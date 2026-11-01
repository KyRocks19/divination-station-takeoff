"use client";

import Link from "next/link";
import { TAROT_DECK } from "@/lib/cards";
import { SUIT_META } from "@/lib/suit-meta";
import { ELEMENT_COLOR, getCardAssociations, type Element } from "@/lib/card-associations";
import { styleRef } from "@/lib/apply-style";

const ELEMENTS: { element: Element; suit: string; description: string }[] = [
  { element: "Fire",  suit: "wands",     description: "Change · Creativity · Will · Hot & Dry · Inward" },
  { element: "Earth", suit: "pentacles", description: "Physical · Feeling · Stability · Cold & Dry · Downward" },
  { element: "Air",   suit: "swords",    description: "Mental · Thinking · Logic · Hot & Wet · Upward" },
  { element: "Water", suit: "cups",      description: "Emotional · Understanding · Intuition · Cold & Wet · Outward" },
];

const RANK_ORDER = ["ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "page", "knight", "queen", "king"];

function buildElementBuckets() {
  const buckets: Record<Element, { major: typeof TAROT_DECK; minor: Record<string, typeof TAROT_DECK> }> = {
    Fire:  { major: [], minor: {} },
    Earth: { major: [], minor: {} },
    Air:   { major: [], minor: {} },
    Water: { major: [], minor: {} },
  };

  for (const card of TAROT_DECK) {
    const assoc = getCardAssociations(card.id);
    if (!assoc.element) continue;

    if (card.suit === "major") {
      buckets[assoc.element].major.push(card);
    } else {
      const [suit] = card.id.split("-");
      if (!buckets[assoc.element].minor[suit]) buckets[assoc.element].minor[suit] = [];
      buckets[assoc.element].minor[suit].push(card);
    }
  }

  return buckets;
}

const BUCKETS = buildElementBuckets();

export default function ElementMap() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {ELEMENTS.map(({ element, suit, description }) => {
        const color = ELEMENT_COLOR[element];
        const suitColor = SUIT_META[suit]?.color ?? color;
        const bucket = BUCKETS[element];
        const minorCards = RANK_ORDER.flatMap((rank) => {
          const card = TAROT_DECK.find((c) => c.id === `${suit}-${rank}`);
          return card ? [card] : [];
        });

        return (
          <div
            key={element}
            className="rounded-xl border space-y-3 p-4"
            ref={styleRef({ borderColor: `${color}33`, backgroundColor: `${color}08` })}
          >
            {/* Element header */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold" ref={styleRef({ color })}>
                {element}
              </h3>
              <p className="text-[10px] text-ink-ghost leading-relaxed">{description}</p>
            </div>

            {/* Major arcana with this element */}
            {bucket.major.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-widest text-ink-ghost">Major Arcana</p>
                <div className="flex flex-wrap gap-1.5">
                  {bucket.major.map((card) => {
                    const assoc = getCardAssociations(card.id);
                    return (
                      <Link
                        key={card.id}
                        href={`/cards/${card.id}`}
                        title={assoc.cosmicRuler ? `Ruled by ${assoc.cosmicRuler}` : undefined}
                        className="text-[11px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
                        ref={styleRef({ backgroundColor: `${color}22`, color })}
                      >
                        {card.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suit cards */}
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-ink-ghost">
                {SUIT_META[suit]?.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {minorCards.map((card) => (
                  <Link
                    key={card.id}
                    href={`/cards/${card.id}`}
                    className="text-[11px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
                    ref={styleRef({ backgroundColor: `${suitColor}22`, color: suitColor })}
                  >
                    {card.name.split(" ")[0]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
