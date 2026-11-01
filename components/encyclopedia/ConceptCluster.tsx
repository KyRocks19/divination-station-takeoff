"use client";

import Link from "next/link";
import { SUIT_META } from "@/lib/suit-meta";
import { styleRef } from "@/lib/apply-style";

interface Concept {
  id: number;
  name: string;
  display_name: string;
  card_count: number;
  dominant_suit?: string;
}

interface Props {
  concepts: Concept[];
}

const SUIT_ORDER = ["major", "cups", "wands", "swords", "pentacles"];

export default function ConceptCluster({ concepts }: Props) {
  const bySuit: Record<string, Concept[]> = {};
  for (const suit of SUIT_ORDER) bySuit[suit] = [];

  for (const c of concepts) {
    const suit = c.dominant_suit ?? "major";
    if (bySuit[suit]) bySuit[suit].push(c);
    else bySuit["major"].push(c);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
      {SUIT_ORDER.map((suit) => {
        const meta = SUIT_META[suit];
        const list = bySuit[suit];
        return (
          <div key={suit} className="space-y-2">
            <div
              className="text-xs font-semibold uppercase tracking-widest pb-2 border-b"
              ref={styleRef({ color: meta.color, borderColor: `${meta.color}33` })}
            >
              {meta.label}
              <span className="ml-1 font-normal text-ink-ghost">({list.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {list
                .sort((a, b) => b.card_count - a.card_count)
                .map((c) => (
                  <Link
                    key={c.id}
                    href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                    className="inline-block rounded-full px-2.5 py-0.5 text-xs transition-opacity hover:opacity-80"
                    ref={styleRef({
                      backgroundColor: `${meta.color}22`,
                      color: meta.color,
                      fontSize: Math.max(10, Math.min(14, 9 + c.card_count)) + "px",
                    })}
                    title={`${c.display_name} — appears in ${c.card_count} card${c.card_count !== 1 ? "s" : ""}`}
                  >
                    {c.display_name}
                  </Link>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
