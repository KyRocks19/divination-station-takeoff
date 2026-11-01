"use client";

import { useState } from "react";
import AddToDay from "@/components/AddToDay";
import ReactMarkdown from "react-markdown";
import { parseDate } from "@/lib/date";
import { SigilMark } from "@/components/ui/AppSigil";

interface SynthesisEntry {
  id: number;
  prompt: string;
  content: string;
  context_ids: string;
  created_at: string;
}

export default function SynthesisJournalCard({ entry }: { entry: SynthesisEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ctx = JSON.parse(entry.context_ids) as { reading_ids: number[]; journal_ids: number[] };
  const totalContext = (ctx.reading_ids?.length ?? 0) + (ctx.journal_ids?.length ?? 0);

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-4 py-4 space-y-1.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-tone-400 uppercase tracking-widest mb-1">
              <SigilMark /> Synthesis · {totalContext} source{totalContext !== 1 ? "s" : ""}
            </p>
            <p className="text-sm font-medium text-ink-strong line-clamp-2">{entry.prompt}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-xs text-ink-ghost">{parseDate(entry.created_at).toLocaleDateString()}</span>
            <span className="text-xs text-ink-ghost">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {!expanded && (
          <p className="text-xs text-ink-faint line-clamp-2">{entry.content}</p>
        )}
      </button>

      {expanded && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <div className="text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-strong:text-tone-300 prose-em:text-tone-300 prose-headings:text-tone-300">
            <ReactMarkdown>{entry.content}</ReactMarkdown>
          </div>
          <div className="mt-3"><AddToDay kind="synthesis_journal" refId={entry.id} /></div>
        </div>
      )}
    </div>
  );
}
