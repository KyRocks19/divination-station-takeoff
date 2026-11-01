"use client";

import Link from "next/link";
import { TAROT_DECK } from "@/lib/cards";
import { SUIT_META } from "@/lib/suit-meta";
import {
  getCardAssociations,
  ELEMENT_COLOR,
  PLANET_META,
  ZODIAC_META,
  type ZodiacSign,
} from "@/lib/card-associations";
import { getCardStructure, cardsSharingRank } from "@/lib/card-structure";
import NoteButton from "./NoteButton";
import GroupNote from "./GroupNote";
import { groupNoteId } from "@/lib/card-groups";
import { usePrefs } from "./usePrefs";
import { styleRef } from "@/lib/apply-style";

interface Props {
  cardId: string;
  /** "full" adds the association rows and the cards that share this number. */
  detail?: "tiles" | "full";
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-1.5 min-w-[4.5rem] text-center bg-canvas"
      ref={styleRef({ borderColor: color ? `${color}66` : "var(--color-line)" })}
    >
      <p className="text-[9px] uppercase tracking-widest text-ink-faint">{label}</p>
      <p className="text-lg font-bold leading-tight" ref={styleRef({ color: color ?? "var(--color-heading)" })}>{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-baseline">
      <dt className="text-[10px] uppercase tracking-widest text-ink-faint w-16 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-ink-soft flex flex-wrap items-baseline gap-x-2 gap-y-1">{children}</dd>
    </div>
  );
}

/**
 * A card's number and suit shown large, with the associations each one carries. A minor card is a suit
 * plus a number, so this is the part of a card that can be learned once and reused across the deck.
 */
export default function CardStructure({ cardId, detail = "tiles" }: Props) {
  const prefs = usePrefs();
  const structure = getCardStructure(cardId);
  if (!structure) return null;

  const assoc = getCardAssociations(cardId);
  const suitColor = SUIT_META[structure.suit]?.color;
  const elementColor = assoc.element ? ELEMENT_COLOR[assoc.element] : undefined;
  const zodiac = assoc.zodiacSign ? ZODIAC_META[assoc.zodiacSign as ZodiacSign] : undefined;
  const ruler = assoc.cosmicRuler ? PLANET_META[assoc.cosmicRuler] : undefined;
  const isMajor = structure.kind === "major";
  const sameRank = cardsSharingRank(cardId);
  const mundane = assoc.mundaneCard ? TAROT_DECK.find((c) => c.id === assoc.mundaneCard) : undefined;

  const tiles = (
    <div className="flex flex-wrap gap-2">
      <Tile label={structure.kind === "court" ? "Rank" : "Number"} value={structure.rankLabel} />
      <Tile label="Suit" value={structure.suitLabel} color={suitColor} />
      {assoc.element && <Tile label="Element" value={assoc.element} color={elementColor} />}
    </div>
  );

  if (detail === "tiles") return tiles;

  return (
    <section aria-label="Number, suit, and associations" className="space-y-4">
      {tiles}

      {prefs.scaffolding === "more" && !isMajor && (
        <p className="text-xs text-ink-faint leading-relaxed">
          A minor card is a suit plus a number. Every {structure.suitLabel.replace(/s$/, "")} card shares the suit
          row below, and all four {structure.rankPlural} share the number row. Learn the four suits and fourteen
          ranks and you can find your way around all 56 minor cards.
        </p>
      )}

      <dl className="bg-surface border border-line-faint rounded-xl p-4 space-y-2.5">
        {!isMajor && (
          <Row label="Suit">
            <span ref={styleRef({ color: suitColor })}>{structure.suitLabel}</span>
            {assoc.element && <span ref={styleRef({ color: elementColor })}>{assoc.element}</span>}
            {(assoc.temperature || assoc.moisture) && (
              <span>{[assoc.temperature, assoc.moisture].filter(Boolean).join(" & ")}</span>
            )}
            {assoc.realm && <span>{assoc.realm} realm</span>}
            {assoc.domain && <span>{assoc.domain}</span>}
            {assoc.direction && <span>moves {assoc.direction.toLowerCase()}</span>}
          </Row>
        )}

        {!isMajor && (
          <Row label={structure.kind === "court" ? "Rank" : "Number"}>
            <span className="text-ink-strong">{structure.rankPlural}</span>
            {zodiac ? (
              <span ref={styleRef({ color: ELEMENT_COLOR[zodiac.element] })}>
                {assoc.zodiacSign} — {zodiac.gloss}, {zodiac.triplicity} {zodiac.element}
              </span>
            ) : (
              <span className="text-ink-ghost">no sign assigned</span>
            )}
          </Row>
        )}

        {isMajor && (
          <>
            {assoc.cosmicRuler && (
              <Row label="Ruler">
                <span ref={styleRef({ color: ruler?.color })}>{ruler?.symbol} {assoc.cosmicRuler}</span>
                {zodiac && <span>{zodiac.gloss}, {zodiac.triplicity} {zodiac.element}, {zodiac.dates}</span>}
              </Row>
            )}
            {assoc.hermeticPrinciple && <Row label="Principle">{assoc.hermeticPrinciple}</Row>}
            {assoc.color && <Row label="Colour">{assoc.color}</Row>}
            {assoc.chord && (
              <Row label="Note">
                {assoc.chord}
                <NoteButton notes={[assoc.chord]} label="Play" />
              </Row>
            )}
            {mundane && (
              <Row label="Everyday">
                <Link href={`/cards/${encodeURIComponent(mundane.id)}`} className="text-accent-ink hover:text-accent-ink-hover transition-colors">
                  {mundane.name}
                </Link>
                <span className="text-ink-ghost">its mundane manifestation</span>
              </Row>
            )}
          </>
        )}

        {sameRank.length > 0 && (
          <Row label="Also">
            <span className="text-ink-faint">the other {structure.rankPlural}:</span>
            {sameRank.map((c) => (
              <Link
                key={c.id}
                href={`/cards/${encodeURIComponent(c.id)}`}
                className="hover:underline max-sm:inline-flex max-sm:items-center max-sm:min-h-11"
                ref={styleRef({ color: SUIT_META[c.suit]?.color })}
              >
                {c.name}
              </Link>
            ))}
          </Row>
        )}
      </dl>

      {/* The person's own words for the whole suit and the whole number, so they are learned once and used across the deck. */}
      {!isMajor && groupNoteId("suit", structure.suit) && groupNoteId("rank", structure.rank) && (
        <div className="bg-surface border border-line-faint rounded-xl p-4 space-y-5">
          <GroupNote groupId={groupNoteId("suit", structure.suit)!} label={structure.suitLabel} hints={prefs.scaffolding === "more"} />
          <GroupNote groupId={groupNoteId("rank", structure.rank)!} label={structure.rankPlural} hints={prefs.scaffolding === "more"} />
        </div>
      )}
    </section>
  );
}
