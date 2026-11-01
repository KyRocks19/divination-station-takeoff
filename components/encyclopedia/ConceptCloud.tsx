"use client";

import { useState, useMemo } from "react";
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

export default function ConceptCloud({ concepts }: Props) {
  const [mode, setMode] = useState<"cloud" | "grid">("cloud");

  const sorted = useMemo(
    () => [...concepts].sort((a, b) => b.card_count - a.card_count),
    [concepts]
  );

  const maxCount = sorted[0]?.card_count ?? 1;

  function suitColor(suit?: string) {
    return SUIT_META[suit ?? "major"]?.color ?? "#7c3aed";
  }

  if (mode === "grid") {
    return (
      <div className="space-y-4">
        <ModeToggle mode={mode} setMode={setMode} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sorted.map((c) => {
            const color = suitColor(c.dominant_suit);
            const intensity = c.card_count / maxCount;
            return (
              <Link
                key={c.id}
                href={`/encyclopedia/${encodeURIComponent(c.name)}`}
                className="rounded-lg p-3 text-center transition-opacity hover:opacity-80 space-y-0.5"
                ref={styleRef({ backgroundColor: `${color}${Math.round(intensity * 0.35 * 255).toString(16).padStart(2, "0")}` })}
              >
                <p className="text-xs font-medium text-ink-strong leading-tight">{c.display_name}</p>
                <p className="text-[10px]" ref={styleRef({ color: `${color}cc` })}>{c.card_count} card{c.card_count !== 1 ? "s" : ""}</p>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Cloud mode — CSS-based word cloud (no layout engine dependency)
  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} setMode={setMode} />
      <div className="flex flex-wrap gap-2 justify-center py-4 px-2">
        {sorted.map((c) => {
          const color = suitColor(c.dominant_suit);
          const scale = 0.6 + (c.card_count / maxCount) * 0.8;
          return (
            <Link
              key={c.id}
              href={`/encyclopedia/${encodeURIComponent(c.name)}`}
              className="transition-opacity hover:opacity-75"
              ref={styleRef({
                fontSize: `${Math.round(scale * 16)}px`,
                color,
                opacity: 0.5 + scale * 0.5,
                lineHeight: 1.4,
              })}
              title={`${c.display_name} — ${c.card_count} card${c.card_count !== 1 ? "s" : ""}`}
            >
              {c.display_name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "cloud" | "grid";
  setMode: (m: "cloud" | "grid") => void;
}) {
  return (
    <div className="flex gap-2">
      {(["cloud", "grid"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors capitalize ${
            mode === m
              ? "bg-tone-800/60 text-tone-200"
              : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
