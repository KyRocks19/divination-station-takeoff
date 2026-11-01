"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { parseDate } from "@/lib/date";
import { BackLink, SectionLabel } from "@/components/ui/Page";
import { SigilMark } from "@/components/ui/AppSigil";

interface DrawnCard { position: string; card_id: string; card_name: string; reversed: boolean; }
interface Journal { id: number; reading_id: number; author: string; content: string; created_at: string; }
interface Reading {
  id: number;
  spread_name: string;
  title: string;
  question: string;
  cards: DrawnCard[];
  created_at: string;
  journals?: Journal[];
}

export default function NewSynthesisJournalPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedReadingIds, setSelectedReadingIds] = useState<Set<number>>(new Set());
  const [expandedReadings, setExpandedReadings] = useState<Set<number>>(new Set());
  const [selectedJournalIds, setSelectedJournalIds] = useState<Set<number>>(new Set());

  // Prompt + response
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function loadData() {
      const [readingsRes, journalsRes] = await Promise.all([
        fetch("/api/readings"),
        fetch("/api/journals"),
      ]);
      if (readingsRes.ok) setReadings(await readingsRes.json());
      if (journalsRes.ok) setJournals(await journalsRes.json());
      setLoading(false);
    }
    loadData();
  }, []);

  function toggleReading(id: number) {
    setSelectedReadingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Deselect all journals from this reading
        const toDeselect = journals.filter((j) => j.reading_id === id).map((j) => j.id);
        setSelectedJournalIds((pj) => {
          const nj = new Set(pj);
          toDeselect.forEach((jid) => nj.delete(jid));
          return nj;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleReadingExpand(id: number) {
    setExpandedReadings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleJournal(jid: number) {
    setSelectedJournalIds((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid); else next.add(jid);
      return next;
    });
  }

  // Journals not already covered by a selected reading
  const standaloneJournals = journals.filter(
    (j) => !selectedReadingIds.has(j.reading_id),
  );

  // Journals keyed by reading id
  const journalsByReading: Record<number, Journal[]> = {};
  for (const j of journals) {
    if (!journalsByReading[j.reading_id]) journalsByReading[j.reading_id] = [];
    journalsByReading[j.reading_id].push(j);
  }

  const hasContext = selectedReadingIds.size > 0 || selectedJournalIds.size > 0;
  const canAsk = hasContext && prompt.trim() && !streaming;

  async function ask() {
    if (!canAsk) return;
    setResponse("");
    setSaved(false);
    setStreaming(true);
    abortRef.current = new AbortController();
    let accumulated = "";
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          reading_ids: Array.from(selectedReadingIds),
          journal_ids: Array.from(selectedJournalIds),
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setResponse(err.error ?? "Something went wrong.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setResponse(accumulated);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setResponse("Something went wrong. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  async function save() {
    if (!response || saving) return;
    setSaving(true);
    const res = await fetch("/api/synthesis-journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        content: response,
        reading_ids: Array.from(selectedReadingIds),
        journal_ids: Array.from(selectedJournalIds),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => router.push("/journals"), 800);
    }
  }

  if (loading) return (
    <div role="status" aria-label="Loading" className="min-h-dvh flex items-center justify-center">
      <h1 className="sr-only">New Journal Entry</h1>
      <div aria-hidden="true" className="text-tone-400 text-2xl animate-pulse"><SigilMark /></div>
    </div>
  );

  return (
    <div className="max-w-page mx-auto px-4 py-6 space-y-6">
      <div>
        <BackLink href="/journals">
          ← Journals
        </BackLink>
        <h1 className="text-2xl font-bold text-heading mt-1">New Journal Entry</h1>
        <p className="text-sm text-ink-faint mt-1">Select readings or journal entries as context, then ask Claude a question.</p>
      </div>

      {/* Reading picker */}
      <section className="space-y-2">
        <SectionLabel>
          Include readings
          {selectedReadingIds.size > 0 && (
            <span className="ml-2 text-tone-400">{selectedReadingIds.size} selected</span>
          )}
        </SectionLabel>

        {readings.length === 0 ? (
          <p className="text-sm text-ink-ghost">No readings yet.</p>
        ) : (
          <div className="space-y-1.5">
            {readings.map((r) => {
              const isSelected = selectedReadingIds.has(r.id);
              const isExpanded = expandedReadings.has(r.id);
              const rJournals = journalsByReading[r.id] ?? [];

              return (
                <div
                  key={r.id}
                  className={`bg-surface border rounded-xl overflow-hidden transition-colors ${
                    isSelected ? "border-line-accent" : "border-line"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleReading(r.id)}
                      aria-label={`Include ${r.title || r.spread_name}`}
                        className="accent-tone-500 w-5 h-5 flex-shrink-0"
                    />
                    <button
                      onClick={() => toggleReading(r.id)}
                      aria-pressed={isSelected}
                        className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-medium text-ink-strong truncate">
                        {r.title || r.spread_name}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {r.spread_name} · {parseDate(r.created_at).toLocaleDateString()}
                        {r.question && ` — "${r.question}"`}
                      </p>
                    </button>
                    {rJournals.length > 0 && (
                      <button
                        onClick={() => toggleReadingExpand(r.id)}
                        className="text-xs text-ink-ghost hover:text-tone-400 transition-colors flex-shrink-0 pl-2"
                      >
                        {isExpanded ? "▲" : "▼"} {rJournals.length}
                      </button>
                    )}
                  </div>

                  {/* Individual journals within this reading */}
                  {isExpanded && rJournals.length > 0 && (
                    <div className="border-t border-line-faint divide-y divide-tone-900/10">
                      {rJournals.map((j) => {
                        const isJSelected = selectedJournalIds.has(j.id);
                        const coveredByReading = selectedReadingIds.has(j.reading_id);
                        return (
                          <div key={j.id} className="flex items-start gap-3 px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={isJSelected || coveredByReading}
                              disabled={coveredByReading}
                              onChange={() => toggleJournal(j.id)}
                              aria-label={`Include this journal entry${coveredByReading ? " (already included with its reading)" : ""}`}
                                className="accent-tone-500 w-5 h-5 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] text-tone-500 uppercase tracking-widest">
                                {j.author === "claude" ? <><SigilMark /> Claude</> : "You"} · {parseDate(j.created_at).toLocaleDateString()}
                                {coveredByReading && <span className="ml-1 text-ink-ghost">(included via reading)</span>}
                              </p>
                              <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{j.content}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Standalone journal picker (journals from readings not already selected) */}
      {standaloneJournals.length > 0 && selectedReadingIds.size < readings.length && (
        <section className="space-y-2">
          <SectionLabel>
            Include individual entries
            {selectedJournalIds.size > 0 && (
              <span className="ml-2 text-tone-400">{selectedJournalIds.size} selected</span>
            )}
          </SectionLabel>
          <div className="space-y-1.5">
            {standaloneJournals.map((j) => {
              const isSelected = selectedJournalIds.has(j.id);
              const reading = readings.find((r) => r.id === j.reading_id);
              return (
                <button
                  key={j.id}
                  onClick={() => toggleJournal(j.id)}
                  className={`w-full text-left bg-surface border rounded-xl px-4 py-3 space-y-1 transition-colors ${
                    isSelected ? "border-line-accent" : "border-line hover:border-line-hover"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? "bg-tone-500" : "bg-tone-900"}`} />
                    <p className="text-[11px] text-tone-500 uppercase tracking-widest">
                      {j.author === "claude" ? <><SigilMark /> Claude</> : "You"} · {reading?.title || reading?.spread_name} · {parseDate(j.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-xs text-ink-muted line-clamp-2 pl-4">{j.content}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Prompt */}
      <section className="space-y-2">
        <SectionLabel>Your question or reflection</SectionLabel>
        <textarea aria-label="Your question or reflection"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What patterns do you see across these readings? What does this period of my life reflect? What guidance stands out most?"
          rows={4}
          className="w-full bg-surface border border-line-strong rounded-xl px-4 py-3 text-sm text-ink-strong placeholder-ink-ghost focus:outline-none focus:border-focus resize-none"
        />
        <button
          onClick={ask}
          disabled={!canAsk}
          className="w-full bg-tone-800/70 hover:bg-tone-700/70 disabled:opacity-40 text-tone-100 text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
        >
          {streaming ? "Reading…" : <><SigilMark /> Ask Claude</>}
        </button>
        {!hasContext && (
          <p className="text-xs text-ink-ghost text-center">Select at least one reading or journal entry above</p>
        )}
      </section>

      {/* Streamed response */}
      {(response || streaming) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-tone-400 uppercase tracking-widest"><SigilMark /> Claude&rsquo;s reflection</p>
            {streaming && <span className="text-xs text-tone-400 animate-pulse">Thinking…</span>}
          </div>
          <div className="bg-surface border border-line-strong rounded-xl p-5 text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-strong:text-tone-300 prose-em:text-tone-300 prose-headings:text-tone-300">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>

          {response && !streaming && (
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving || saved}
                className="flex-1 bg-blush hover:bg-blush-soft disabled:opacity-50 text-canvas text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                {saved ? "Saved ✓" : saving ? "Saving…" : "Save to journals"}
              </button>
              <button
                onClick={ask}
                disabled={!canAsk}
                className="text-sm text-ink-faint hover:text-ink-soft border border-line rounded-card px-4 py-2.5 min-h-11 sm:min-h-0 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
