"use client";

import { FEATHERED } from "@/lib/edition";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { AskContent } from "@/components/AskContent";

type Tab = "readings" | "layouts" | "ask";

// The Feathered edition has no AI, so no "Ask Claude" tab (docs/plan-feathered-edition.md).
const TABS: { id: Tab; label: string }[] = [
  { id: "readings", label: "Readings" },
  { id: "layouts", label: "Layouts" },
  ...(FEATHERED ? [] : [{ id: "ask" as const, label: "Ask Claude" }]),
];

export default function ReadingsTabWrapper({ children, forum = true }: { children: React.ReactNode; forum?: boolean }) {
  const [tab, setTab] = useState<Tab>("readings");

  return (
    <div className="max-w-page mx-auto px-4 py-8">
      <div className="flex flex-wrap gap-1.5 mb-6 border-b border-line pb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`text-xs px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg transition-colors ${
              tab === t.id
                ? "bg-tone-800/60 text-tone-200 font-medium"
                : "text-ink-muted hover:text-ink-strong bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "readings" && children}
      {tab === "layouts" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            Your layouts hold the positions you read with, for tarot and for every other tool: each position has a
            name, your own question, an optional colour, and, if you like, a place on a board like the Celtic Cross.
          </p>
          <ButtonLink href="/layouts" variant="primary">Open your layouts</ButtonLink>
        </div>
      )}
      {tab === "ask" && !FEATHERED && <AskContent forum={forum} />}
    </div>
  );
}
