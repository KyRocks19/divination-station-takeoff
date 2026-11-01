"use client";

import { useState } from "react";
import { ELEMENT_COLOR, getCardAssociations, type Element } from "@/lib/card-associations";
import { ELEMENT_QUALITIES, elementOf, getCardStructure, relateElements } from "@/lib/card-structure";
import NoteButton from "./NoteButton";
import { usePrefs } from "./usePrefs";
import { styleRef } from "@/lib/apply-style";

interface DrawnCard { position: string; card_id: string; card_name: string; reversed: boolean; }

const ELEMENTS: Element[] = ["Fire", "Water", "Air", "Earth"];

const RELATION_STYLE = {
  same: "text-ink-strong",
  shared: "text-ink-muted",
  opposite: "text-ink-faint",
} as const;

/**
 * What the cards in a spread have in common by structure: element balance, how neighbouring cards'
 * elements relate, repeated numbers, and the notes of the major arcana. Facts about the cards, not meanings.
 */
export default function SpreadCorrespondences({ cards }: { cards: DrawnCard[] }) {
  const prefs = usePrefs();
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? prefs.scaffolding === "more";

  if (cards.length === 0) return null;

  const withElements = cards.map((c) => ({ card: c, element: elementOf(c.card_id) }));
  const counts = ELEMENTS.map((e) => ({ element: e, count: withElements.filter((w) => w.element === e).length }));

  const pairs = withElements.slice(0, -1).flatMap((a, i) => {
    const b = withElements[i + 1];
    if (!a.element || !b.element) return [];
    return [{ a, b, ...relateElements(a.element, b.element) }];
  });

  const byRank = new Map<string, string[]>();
  for (const c of cards) {
    const s = getCardStructure(c.card_id);
    if (!s || s.kind === "major") continue;
    byRank.set(s.rankPlural, [...(byRank.get(s.rankPlural) ?? []), c.card_name]);
  }
  const repeatedRanks = [...byRank.entries()].filter(([, names]) => names.length > 1);

  const majors = cards.filter((c) => c.card_id.startsWith("major-"));
  const notes = majors.map((c) => getCardAssociations(c.card_id).chord).filter((n): n is string => !!n);

  return (
    <section aria-label="Correspondences in this spread" className="bg-surface border border-line rounded-card">
      <button
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs text-ink-muted uppercase tracking-widest">Correspondences in this spread</span>
        <span className="flex items-center gap-2">
          {counts.filter((c) => c.count > 0).map((c) => (
            <span key={c.element} className="text-[11px]" ref={styleRef({ color: ELEMENT_COLOR[c.element] })}>
              {c.element} {c.count}
            </span>
          ))}
          <span aria-hidden="true" className="text-ink-ghost text-xs">{open ? "▾" : "▸"}</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {prefs.scaffolding === "more" && (
            <p className="text-xs text-ink-faint leading-relaxed">
              Each element is two qualities: Fire is hot and dry, Air hot and wet, Water cold and wet, Earth cold
              and dry. Cards next to each other are compared by the qualities their elements share. These are
              facts about the cards; what they mean here is yours to say.
            </p>
          )}

          {/* Element balance */}
          <div className="space-y-1.5">
            {counts.map(({ element, count }) => (
              <div key={element} className="flex items-center gap-2">
                <span className="text-xs w-12 flex-shrink-0" ref={styleRef({ color: ELEMENT_COLOR[element] })}>{element}</span>
                <div className="h-1.5 rounded-full flex-1 bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full w-0"
                    ref={styleRef({ width: `${(count / cards.length) * 100}%`, background: ELEMENT_COLOR[element] })}
                  />
                </div>
                <span className="text-[11px] text-ink-faint w-28 text-right flex-shrink-0">
                  {count} · {ELEMENT_QUALITIES[element].temperature.toLowerCase()}, {ELEMENT_QUALITIES[element].moisture.toLowerCase()}
                </span>
              </div>
            ))}
          </div>

          {/* Neighbouring cards */}
          {pairs.length > 0 && (
            <div>
              <p className="text-[10px] text-ink-faint uppercase tracking-widest mb-1.5">Neighbours, in position order</p>
              <ul className="space-y-1">
                {pairs.map(({ a, b, relation, text }, i) => (
                  <li key={i} className="text-xs flex flex-wrap gap-x-1.5">
                    <span ref={styleRef({ color: ELEMENT_COLOR[a.element!] })}>{a.card.card_name}</span>
                    <span className="text-ink-ghost">+</span>
                    <span ref={styleRef({ color: ELEMENT_COLOR[b.element!] })}>{b.card.card_name}</span>
                    <span className={RELATION_STYLE[relation]}>— {text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Repeated numbers and majors */}
          {(repeatedRanks.length > 0 || majors.length > 0) && (
            <div className="space-y-1.5 text-xs text-ink-muted">
              {repeatedRanks.map(([rank, names]) => (
                <p key={rank}>
                  <span className="text-ink-strong">{names.length} {rank}:</span> {names.join(", ")}
                </p>
              ))}
              {majors.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    <span className="text-ink-strong">{majors.length} of {cards.length} Major Arcana:</span>{" "}
                    {majors.map((c) => c.card_name).join(", ")}
                  </span>
                  {notes.length > 0 && (
                    <NoteButton notes={notes} label={notes.length > 1 ? "Play their notes in order" : "Play its note"} />
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
