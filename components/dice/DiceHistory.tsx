"use client";

import { useState } from "react";
import { DICE_HISTORY, DICE_HISTORY_SOURCES } from "@/lib/dice-data";
import Cite from "@/components/sources/Cite";
import SourcesLine from "@/components/sources/SourcesLine";

/** A short, sourced history of coinage, dice, and dice divination. It opens only on a press. */
export default function DiceHistory() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-xs text-ink-muted hover:text-ink-strong border border-line hover:border-line-hover rounded-lg py-2 px-3 transition-colors"
      >
        {open ? "Hide " : ""}A little history
      </button>
      {open && (
        <section aria-label="A little history" className="bg-surface-sunken rounded-xl p-4 border border-line-faint space-y-4">
          {DICE_HISTORY.map((s) => (
            <div key={s.heading} className="space-y-1">
              <p className="text-[10px] text-tone-400 uppercase tracking-widest">{s.heading}</p>
              <p className="text-sm text-ink-soft leading-relaxed">{s.text}</p>
              {s.topic && <Cite topic={s.topic} tool="dice" />}
            </div>
          ))}
          <div className="space-y-1">
            <p className="text-[10px] text-tone-400 uppercase tracking-widest">Sources</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {DICE_HISTORY_SOURCES.map((s) => (
                <li key={s.url} className="text-[11px] text-ink-faint break-words">
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-6 max-sm:min-h-11 hover:text-tone-300">{s.title}</a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-ghost">Checked on 2026-10-11. Sources differ on dates, and the note says where.</p>
            <SourcesLine tool="dice" />
          </div>
        </section>
      )}
    </div>
  );
}
