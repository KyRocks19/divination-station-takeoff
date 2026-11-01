"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { parseDate } from "@/lib/date";
import { PageTitle, SectionLabel } from "@/components/ui/Page";
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
}
interface SynthesisJournal { id: number; prompt: string; content: string; created_at: string; }
interface ForumPost { id: number; title: string; body: string; username: string; display_name: string | null; created_at: string; }

type ContextTab = "readings" | "synthesis" | "forum" | "tags";

/** The Ask Claude screen. `forum` is false on a copy without the forum (lib/edition-features.ts), so it neither asks for posts nor shows the tab. */
export function AskContent({ forum = true }: { forum?: boolean }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [synthesisJournals, setSynthesisJournals] = useState<SynthesisJournal[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ContextTab>("readings");

  // Selection state
  const [selectedReadingIds, setSelectedReadingIds] = useState<Set<number>>(new Set());
  const [expandedReadings, setExpandedReadings] = useState<Set<number>>(new Set());
  const [selectedJournalIds, setSelectedJournalIds] = useState<Set<number>>(new Set());
  const [selectedSynthesisIds, setSelectedSynthesisIds] = useState<Set<number>>(new Set());
  const [selectedForumPostId, setSelectedForumPostId] = useState<number | null>(null);
  const [includeTags, setIncludeTags] = useState(false);

  // Question + response
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function load() {
      const [readingsRes, journalsRes, synthesisRes, forumRes] = await Promise.all([
        fetch("/api/readings"),
        fetch("/api/journals"),
        fetch("/api/synthesis-journals"),
        forum ? fetch("/api/forum") : Promise.resolve(null),
      ]);
      if (readingsRes.ok) setReadings(await readingsRes.json());
      if (journalsRes.ok) setJournals(await journalsRes.json());
      if (synthesisRes.ok) setSynthesisJournals(await synthesisRes.json());
      if (forumRes?.ok) setForumPosts(await forumRes.json());
      setLoading(false);
    }
    load();
  }, [forum]);

  const journalsByReading: Record<number, Journal[]> = {};
  for (const j of journals) {
    if (!journalsByReading[j.reading_id]) journalsByReading[j.reading_id] = [];
    journalsByReading[j.reading_id].push(j);
  }

  function toggleReading(id: number) {
    setSelectedReadingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
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

  function toggleJournal(jid: number) {
    setSelectedJournalIds((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid); else next.add(jid);
      return next;
    });
  }

  function toggleSynthesis(id: number) {
    setSelectedSynthesisIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const contextCount =
    selectedReadingIds.size +
    selectedJournalIds.size +
    selectedSynthesisIds.size +
    (selectedForumPostId ? 1 : 0) +
    (includeTags ? 1 : 0);

  const canAsk = contextCount > 0 && question.trim() && !streaming;

  async function ask() {
    if (!canAsk) return;
    setResponse("");
    setError("");
    setStreaming(true);
    abortRef.current = new AbortController();
    let accumulated = "";
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          reading_ids: Array.from(selectedReadingIds),
          journal_ids: Array.from(selectedJournalIds),
          synthesis_journal_ids: Array.from(selectedSynthesisIds),
          forum_post_id: selectedForumPostId ?? undefined,
          include_tags: includeTags,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setError(err.error ?? "Something went wrong.");
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
      if (e.name !== "AbortError") setError("Something went wrong. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  const tabs: { id: ContextTab; label: string; count?: number }[] = [
    { id: "readings", label: "Readings", count: selectedReadingIds.size + selectedJournalIds.size },
    { id: "synthesis", label: "Synthesis", count: selectedSynthesisIds.size },
    ...(forum ? [{ id: "forum" as const, label: "Forum", count: selectedForumPostId ? 1 : 0 }] : []),
    { id: "tags", label: "Tags" },
  ];

  if (loading) return (
    <div role="status" aria-label="Loading" className="flex items-center justify-center py-20">
      <h1 className="sr-only">Ask Claude</h1>
      <div aria-hidden="true" className="text-tone-400 text-2xl animate-pulse"><SigilMark /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Ask Claude</PageTitle>
        <p className="text-sm text-ink-faint mt-1">
          Select context from your readings, journals, forum posts, or tags, then ask anything.
        </p>
      </div>

      {/* Context tabs */}
      <section className="space-y-3">
        <div className="flex flex-wrap gap-1 bg-canvas border border-line rounded-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`flex-1 text-xs py-1.5 px-2 min-h-11 sm:min-h-0 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-tone-800/60 text-tone-200"
                  : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {tab.label}
              {tab.count ? <span className="ml-1 text-tone-400">{tab.count}</span> : null}
            </button>
          ))}
        </div>

        {/* Readings tab */}
        {activeTab === "readings" && (
          <div className="space-y-1.5">
            {readings.length === 0 ? (
              <p className="text-sm text-ink-ghost">No readings yet.</p>
            ) : (
              readings.map((r) => {
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
                          onClick={() => setExpandedReadings((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                            return next;
                          })}
                          className="text-xs text-ink-ghost hover:text-tone-400 transition-colors flex-shrink-0 pl-2"
                        >
                          {isExpanded ? "▲" : "▼"} {rJournals.length}
                        </button>
                      )}
                    </div>
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
              })
            )}
          </div>
        )}

        {/* Synthesis journals tab */}
        {activeTab === "synthesis" && (
          <div className="space-y-1.5">
            {synthesisJournals.length === 0 ? (
              <p className="text-sm text-ink-ghost">No synthesis journals yet.</p>
            ) : (
              synthesisJournals.map((s) => {
                const isSelected = selectedSynthesisIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSynthesis(s.id)}
                    className={`w-full text-left bg-surface border rounded-xl px-4 py-3 space-y-1 transition-colors ${
                      isSelected ? "border-line-accent" : "border-line hover:border-line-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? "bg-tone-500" : "bg-tone-900"}`} />
                      <p className="text-[11px] text-tone-500 uppercase tracking-widest">
                        {parseDate(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-xs text-ink-soft font-medium pl-4 line-clamp-1">{s.prompt}</p>
                    <p className="text-xs text-ink-faint line-clamp-2 pl-4">{s.content}</p>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Forum tab */}
        {activeTab === "forum" && (
          <div className="space-y-1.5">
            {forumPosts.length === 0 ? (
              <p className="text-sm text-ink-ghost">No forum posts yet.</p>
            ) : (
              forumPosts.map((p) => {
                const isSelected = selectedForumPostId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedForumPostId(isSelected ? null : p.id)}
                    className={`w-full text-left bg-surface border rounded-xl px-4 py-3 space-y-1 transition-colors ${
                      isSelected ? "border-line-accent" : "border-line hover:border-line-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? "bg-tone-500" : "bg-tone-900"}`} />
                      <p className="text-sm font-medium text-ink-strong truncate">{p.title}</p>
                    </div>
                    <p className="text-[11px] text-ink-faint pl-4">
                      {p.display_name || p.username} · {parseDate(p.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-ink-faint line-clamp-2 pl-4">{p.body}</p>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Tags tab */}
        {activeTab === "tags" && (
          <div className="bg-surface border border-line rounded-card px-4 py-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTags}
                onChange={(e) => setIncludeTags(e.target.checked)}
                className="accent-tone-500 w-4 h-4"
              />
              <div>
                <p className="text-sm text-ink-strong">Include my tags as context</p>
                <p className="text-xs text-ink-faint mt-0.5">
                  Shares your tag list so Claude understands your personal vocabulary
                </p>
              </div>
            </label>
          </div>
        )}
      </section>

      {/* Question */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Your question</SectionLabel>
          {contextCount > 0 && (
            <span className="text-xs text-tone-500">
              {contextCount} context item{contextCount !== 1 ? "s" : ""} selected
            </span>
          )}
        </div>
        <textarea aria-label="Your question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does the Tower card keep showing up for me? What themes connect these readings? What should I focus on right now?"
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
        {contextCount === 0 && (
          <p className="text-xs text-ink-ghost text-center">Select at least one context item above</p>
        )}
        {error && (
          <p className="text-xs text-danger-ink text-center">{error}</p>
        )}
      </section>

      {/* Response */}
      {(response || streaming) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-tone-400 uppercase tracking-widest"><SigilMark /> Claude&rsquo;s response</p>
            {streaming && <span className="text-xs text-tone-400 animate-pulse">Thinking…</span>}
          </div>
          <div className="bg-surface border border-line-strong rounded-xl p-5 text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-strong:text-tone-300 prose-em:text-tone-300 prose-headings:text-tone-300">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
          {response && !streaming && (
            <button
              onClick={ask}
              disabled={!canAsk}
              className="text-sm text-ink-faint hover:text-ink-soft border border-line rounded-card px-4 py-2.5 min-h-11 sm:min-h-0 transition-colors"
            >
              Ask again
            </button>
          )}
        </section>
      )}
    </div>
  );
}
