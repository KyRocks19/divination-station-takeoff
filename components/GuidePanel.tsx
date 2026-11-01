"use client";

import { FEATHERED } from "@/lib/edition";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { errorText } from "@/lib/ai-client";
import { SigilMark } from "@/components/ui/AppSigil";

interface SavedGuide {
  id: number;
  content: string;
  created_at: string;
}

/**
 * The guide on a reading with any tool but tarot (open item Y3; the tarot reading page has its own). It looks across everything the person has
 * done, in their own words (POST /api/guide with the reading's shared id), asks three or four open questions, and the person may keep what it
 * said with the reading. Kept entries are listed apart from the person's own writing and can be deleted.
 */
function GuidePanelInner({ divinationId }: { divinationId: number }) {
  const [response, setResponse] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [kept, setKept] = useState<SavedGuide[]>([]);
  const result = useRef<HTMLDivElement>(null);
  const ask = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/divinations/${divinationId}/guide`).catch(() => null);
    if (res?.ok) setKept(await res.json().catch(() => []));
  }, [divinationId]);
  useEffect(() => {
    load();
  }, [load]);

  // The button that was pressed goes away as the answer arrives: put focus where the person goes next.
  useEffect(() => {
    if (response && !fetching) result.current?.focus();
    else if (!response && !fetching && asked.current) ask.current?.focus();
  }, [response, fetching]);

  async function generate() {
    if (fetching) return;
    asked.current = true;
    setResponse("");
    setSaved(false);
    setError("");
    setFetching(true);
    let accumulated = "";
    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ divination_id: divinationId }),
      });
      if (!res.ok || !res.body) {
        setError(await errorText(res, "Something went wrong. Try again."));
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
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setFetching(false);
    }
  }

  async function keep() {
    if (!response || saved) return;
    const res = await fetch(`/api/divinations/${divinationId}/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: response }),
    }).catch(() => null);
    if (res?.ok) {
      setSaved(true);
      load();
    } else setError("That could not be saved. Try again.");
  }

  async function remove(entry: SavedGuide) {
    if (!window.confirm("Delete this entry from your guide? This cannot be undone.")) return;
    const res = await fetch(`/api/divinations/${divinationId}/journals/${entry.id}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 404)) await load();
    else setError("That could not be deleted. Try again.");
  }

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-label="Your guide" className="bg-surface-sunken border border-tone-900/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-tone-400/80 uppercase tracking-widest"><SigilMark /> Your Guide</p>
        <span role="status" className="text-xs">
          {fetching && <span className="text-ink-muted animate-pulse">Your guide is present…</span>}
          {saved && <span className="text-success">Saved ✓</span>}
        </span>
      </div>
      <p className="text-xs text-ink-faint leading-relaxed">
        Asks open questions about the whole of your practice, with every tool, from your own words and the names of what came up. It gives no traditional
        meaning and predicts nothing.
      </p>

      {error && <p role="alert" className="text-xs text-danger-ink">{error}</p>}

      {!response && (
        <button
          ref={ask}
          onClick={generate}
          disabled={fetching}
          className="w-full text-xs bg-surface hover:bg-surface-sunken disabled:opacity-50 text-ink-soft hover:text-ink font-medium py-2 px-3 rounded-lg transition-colors border border-line"
        >
          {fetching ? "Listening…" : "What wants to emerge?"}
        </button>
      )}

      {response && (
        <div
          ref={result}
          tabIndex={-1}
          role="group"
          aria-label={saved ? "Your guide, saved" : "Your guide"}
          className="text-sm text-ink-strong leading-relaxed prose prose-invert prose-sm max-w-none border-t border-line-faint pt-3"
        >
          <ReactMarkdown>{response}</ReactMarkdown>
        </div>
      )}

      {response && !fetching && (
        <div className="flex flex-wrap items-center gap-x-4">
          {!saved && (
            <button onClick={keep} className="min-h-11 text-xs text-accent-ink hover:text-accent-ink-hover">
              Keep with this reading
            </button>
          )}
          <button onClick={generate} className="min-h-11 text-xs text-ink-muted hover:text-ink">
            Ask again
          </button>
          <button
            onClick={() => {
              setResponse("");
              setSaved(false);
            }}
            className="min-h-11 text-xs text-ink-muted hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {kept.length > 0 && (
        <div className="space-y-2 border-t border-line-faint pt-3">
          <h3 className="text-xs text-ink-muted">Kept from your guide</h3>
          <ul className="space-y-2">
            {kept.map((s) => (
              <li key={s.id} className="border border-line rounded-lg p-2">
                <details>
                  <summary className="cursor-pointer text-xs text-ink-soft">{when(s.created_at)}</summary>
                  <div className="text-sm text-ink-strong leading-relaxed prose prose-invert prose-sm max-w-none mt-2">
                    <ReactMarkdown>{s.content}</ReactMarkdown>
                  </div>
                  <button
                    onClick={() => remove(s)}
                    className="mt-2 min-h-6 text-xs text-danger-ink hover:text-danger-soft"
                    aria-label={`Delete the guide entry from ${when(s.created_at)}`}
                  >
                    Delete
                  </button>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function GuidePanel(props: { divinationId: number }) {
  return FEATHERED ? null : <GuidePanelInner {...props} />;
}
