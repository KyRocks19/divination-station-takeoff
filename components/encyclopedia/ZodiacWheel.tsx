"use client";

import { useState } from "react";
import Link from "next/link";
import { TAROT_DECK } from "@/lib/cards";
import { SUIT_META } from "@/lib/suit-meta";
import {
  ZODIAC_ORDER,
  ZODIAC_META,
  ELEMENT_COLOR,
  PLANET_META,
  getCardAssociations,
  type ZodiacSign,
} from "@/lib/card-associations";
import { styleRef } from "@/lib/apply-style";

// Build lookup: zodiac → { majorCard, minorCards }
function buildZodiacLookup() {
  const lookup: Record<string, { majorCard: typeof TAROT_DECK[0] | null; minorCards: typeof TAROT_DECK }> = {};

  for (const sign of ZODIAC_ORDER) {
    lookup[sign] = { majorCard: null, minorCards: [] };
  }

  for (const card of TAROT_DECK) {
    const assoc = getCardAssociations(card.id);
    if (!assoc.zodiacSign) continue;
    const bucket = lookup[assoc.zodiacSign];
    if (!bucket) continue;

    if (card.suit === "major") {
      bucket.majorCard = card;
    } else {
      bucket.minorCards.push(card);
    }
  }

  return lookup;
}

// Cards ruled by celestial bodies (no direct zodiac sign)
function buildCelestialCards() {
  return TAROT_DECK.filter((card) => {
    if (card.suit !== "major") return false;
    const assoc = getCardAssociations(card.id);
    return !assoc.zodiacSign && assoc.cosmicRuler;
  });
}

const ZODIAC_LOOKUP = buildZodiacLookup();
const CELESTIAL_CARDS = buildCelestialCards();

export default function ZodiacWheel() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Zodiac grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {ZODIAC_ORDER.map((sign) => {
          const meta = ZODIAC_META[sign as ZodiacSign];
          const elColor = ELEMENT_COLOR[meta.element];
          const { majorCard, minorCards } = ZODIAC_LOOKUP[sign];
          const isOpen = expanded === sign;

          return (
            <div
              key={sign}
              onClick={() => setExpanded(isOpen ? null : sign)}
              className="cursor-pointer rounded-xl border transition-all"
              ref={styleRef({
                borderColor: isOpen ? `${elColor}66` : `${elColor}22`,
                backgroundColor: isOpen ? `${elColor}11` : "var(--color-field)",
              })}
            >
              {/* Sign header */}
              <div className="p-3 space-y-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl leading-none" ref={styleRef({ color: elColor })}>
                    {meta.symbol}
                  </span>
                  <span className="text-sm font-semibold text-ink-strong">{meta.name}</span>
                  <span
                    className="ml-auto text-[9px] uppercase tracking-widest opacity-50"
                    ref={styleRef({ color: elColor })}
                  >
                    {meta.triplicity}
                  </span>
                </div>
                <p className="text-[10px] text-ink-ghost">{meta.gloss} · {meta.dates}</p>
                <p className="text-[9px] uppercase tracking-widest" ref={styleRef({ color: `${elColor}99` })}>
                  {meta.element}
                </p>
              </div>

              {/* Major arcana */}
              {majorCard && (
                <div
                  className="px-3 pb-2 text-xs font-medium"
                  ref={styleRef({ color: elColor })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/cards/${majorCard.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {majorCard.name}
                  </Link>
                </div>
              )}

              {/* Expanded: show the 4 minor arcana cards of this rank */}
              {isOpen && minorCards.length > 0 && (
                <div className="px-3 pb-3 pt-1 border-t space-y-1" ref={styleRef({ borderColor: `${elColor}22` })}>
                  <p className="text-[9px] uppercase tracking-widest text-ink-ghost mb-1.5">
                    {minorCards[0]?.name.split(" ").slice(0, -2).join(" ")} rank
                  </p>
                  <div className="flex flex-col gap-1">
                    {minorCards.map((c) => {
                      const suitColor = SUIT_META[c.suit]?.color ?? "#7c3aed";
                      return (
                        <Link
                          key={c.id}
                          href={`/cards/${c.id}`}
                          className="text-xs hover:underline transition-colors"
                          ref={styleRef({ color: suitColor })}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Celestial / planet-ruled major arcana */}
      <div className="space-y-3">
        <p className="text-xs text-ink-faint uppercase tracking-widest">
          Celestial rulers — planet-ruled major arcana
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {CELESTIAL_CARDS.map((card) => {
            const assoc = getCardAssociations(card.id);
            const ruler = assoc.cosmicRuler ?? "";
            const pm = PLANET_META[ruler];
            const color = pm?.color ?? "#7c3aed";
            return (
              <Link
                key={card.id}
                href={`/cards/${card.id}`}
                className="rounded-lg p-3 border hover:opacity-80 transition-opacity space-y-1"
                ref={styleRef({ backgroundColor: `${color}11`, borderColor: `${color}33` })}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base" ref={styleRef({ color })}>
                    {pm?.symbol ?? "✦"}
                  </span>
                  <span className="text-[10px] text-ink-faint">{ruler}</span>
                </div>
                <p className="text-xs font-medium text-ink-strong">{card.name}</p>
                {assoc.element && (
                  <p className="text-[9px] uppercase tracking-widest" ref={styleRef({ color: ELEMENT_COLOR[assoc.element] })}>
                    {assoc.element}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
