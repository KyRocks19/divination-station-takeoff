"use client";

import { useAiReady } from "@/components/AiReady";
import { useState, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { TAROT_DECK } from "@/lib/cards";
import { parseDate } from "@/lib/date";
import { DEFAULT_POSITION_COLOR, hexToRgba } from "@/lib/position-colors";
import CardStructure from "./CardStructure";
import MeaningsPanel from "./MeaningsPanel";
import { usePrefs } from "./usePrefs";
import { errorText } from "@/lib/ai-client";
import { styleRef } from "@/lib/apply-style";
import { SigilMark } from "@/components/ui/AppSigil";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
}

interface Impression {
  id: number;
  content: string;
  created_at: string;
}

interface ReadingContext {
  reading_id: number;
  card_index: number;
  onSaveJournal?: () => void;
}

type HieroMode = "questions" | "interpret";

interface Props {
  card: DrawnCard;
  readingContext?: ReadingContext;
  /** What the user has already written about this card in this reading. */
  impressions?: Impression[];
  savedInterpretation?: string;
  onInterpretationSaved?: (text: string) => void;
  savedClarifiers?: DrawnCard[];
  onClarifiersChanged?: (cards: DrawnCard[]) => void;
  savedClarifierInterpretations?: Record<number, string>;
  onClarifierInterpretationSaved?: (clarifierIndex: number, text: string) => void;
  totalDrawCount?: number;
  onClose: () => void;
}

export default function CardDetail({
  card,
  readingContext,
  impressions = [],
  savedInterpretation = "",
  onInterpretationSaved,
  savedClarifiers = [],
  savedClarifierInterpretations = {},
  onClarifierInterpretationSaved,
  totalDrawCount,
  onClose,
}: Props) {
  const prefs = usePrefs();
  const ai = useAiReady();
  const clarifiers = savedClarifiers;

  // The user's own first impression
  const [impression, setImpression] = useState("");
  const [savingImpression, setSavingImpression] = useState(false);

  // Hiero: main card
  const [hieroText, setHieroText] = useState(savedInterpretation);
  const [hieroBusy, setHieroBusy] = useState<HieroMode | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Hiero: clarifiers
  const [clarifierText, setClarifierText] = useState<Record<number, string>>(savedClarifierInterpretations);
  const [clarifierBusy, setClarifierBusy] = useState<number | null>(null);

  async function saveImpression() {
    if (!readingContext || !impression.trim() || savingImpression) return;
    setSavingImpression(true);
    try {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reading_id: readingContext.reading_id,
          author: "user",
          kind: "impression",
          content: impression.trim(),
          card_index: readingContext.card_index,
        }),
      });
      if (res.ok) {
        setImpression("");
        readingContext.onSaveJournal?.();
      }
    } finally {
      setSavingImpression(false);
    }
  }

  async function deleteImpression(id: number) {
    await fetch(`/api/journals/${id}`, { method: "DELETE" });
    readingContext?.onSaveJournal?.();
  }

  /** Stream Hiero's reply into `onText`, then save it to the reading's journal. */
  async function askHiero(mode: HieroMode, clarifierIndex: number | null, onText: (text: string) => void): Promise<string> {
    if (!readingContext) return "";
    abortRef.current = new AbortController();
    let accumulated = "";
    const res = await fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reading_id: readingContext.reading_id,
        card_index: readingContext.card_index,
        ...(clarifierIndex != null ? { clarifier_index: clarifierIndex } : {}),
        mode,
      }),
      signal: abortRef.current.signal,
    });
    if (!res.ok || !res.body) {
      onText(await errorText(res, "Hiero could not answer just now. Try again in a moment."));
      return "";
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      onText(accumulated);
    }
    if (!accumulated) return "";

    const subject = clarifierIndex != null ? clarifiers[clarifierIndex] : card;
    const header = clarifierIndex != null
      ? `**${subject.card_name}${subject.reversed ? " (Reversed)" : ""} — Clarifier for ${card.card_name} (${card.position})**`
      : `**${card.card_name}${card.reversed ? " (Reversed)" : ""} — ${card.position}**`;
    await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reading_id: readingContext.reading_id,
        author: "hiero",
        content: `${header}\n\n${accumulated}`,
        card_index: readingContext.card_index,
        ...(clarifierIndex != null ? { clarifier_index: clarifierIndex } : {}),
      }),
    });
    readingContext.onSaveJournal?.();
    return accumulated;
  }

  async function askAboutCard(mode: HieroMode) {
    if (hieroBusy || clarifierBusy !== null) return;
    setSaved(false);
    setHieroText("");
    setHieroBusy(mode);
    try {
      const text = await askHiero(mode, null, setHieroText);
      if (text) {
        setSaved(true);
        onInterpretationSaved?.(text);
      }
    } catch {
      // AbortError is expected on close; other errors leave whatever text arrived on screen
    } finally {
      setHieroBusy(null);
    }
  }

  async function askAboutClarifier(ci: number, mode: HieroMode) {
    if (hieroBusy || clarifierBusy !== null) return;
    setClarifierText((prev) => ({ ...prev, [ci]: "" }));
    setClarifierBusy(ci);
    try {
      const text = await askHiero(mode, ci, (t) => setClarifierText((prev) => ({ ...prev, [ci]: t })));
      if (text) onClarifierInterpretationSaved?.(ci, text);
    } catch {
      // as above
    } finally {
      setClarifierBusy(null);
    }
  }

  const busy = hieroBusy !== null || clarifierBusy !== null;
  const posColor = card.color ?? DEFAULT_POSITION_COLOR;
  const proseClass = "text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 prose-strong:text-tone-300";

  return (
    <div className="bg-surface border border-line-strong rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-tone-400 uppercase tracking-widest">{card.position}</p>
          <p className="text-lg font-semibold text-ink-strong mt-0.5">
            {card.card_name}
            {card.reversed && (
              <span className="text-sm text-danger-ink ml-2 font-normal">Reversed</span>
            )}
          </p>
          {totalDrawCount && totalDrawCount > 1 && (
            <Link
              href={`/cards/${encodeURIComponent(card.card_id)}`}
              className="inline-block text-[10px] text-ink-faint hover:text-tone-500 transition-colors mt-0.5"
              aria-label={`You've drawn ${card.card_name} ${totalDrawCount} times — see what you wrote before`}
            >
              <SigilMark /> Drawn {totalDrawCount}× in your history
            </Link>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-ink-ghost hover:text-ink-soft transition-colors text-lg leading-none mt-1 flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <CardStructure cardId={card.card_id} />

      {/* The user's own impression comes before any meaning */}
      {readingContext && (
        <section aria-label="What you see" className="space-y-2">
          <label htmlFor={`impression-${readingContext.card_index}`} className="block text-xs text-tone-300 uppercase tracking-widest">
            What do you see?
          </label>
          {prefs.scaffolding === "more" && (
            <p className="text-xs text-ink-faint leading-relaxed">
              Look at the picture before reading anything about it. What is happening? What stands out? How does
              it sit with your question? There is no wrong answer.
            </p>
          )}
          {impressions.map((entry) => (
            <div key={entry.id} className="border-l-2 border-line-hover pl-3">
              <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap">{entry.content}</p>
              <p className="text-[10px] text-ink-ghost mt-0.5">
                {parseDate(entry.created_at).toLocaleString()}
                <button
                  onClick={() => deleteImpression(entry.id)}
                  className="ml-3 hover:text-danger-ink transition-colors"
                >
                  Delete
                </button>
              </p>
            </div>
          ))}
          <textarea
            id={`impression-${readingContext.card_index}`}
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            rows={3}
            placeholder={impressions.length > 0 ? "Add more…" : "Your first impression…"}
            className="w-full bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong placeholder-ink-ghost focus:border-focus resize-y"
          />
          <button
            onClick={saveImpression}
            disabled={savingImpression || !impression.trim()}
            className="text-xs bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas font-medium py-1.5 px-3 rounded-lg transition-colors"
          >
            {savingImpression ? "Saving…" : "Save to this reading"}
          </button>
        </section>
      )}

      {/* Clarifiers drawn for this position */}
      {clarifiers.length > 0 && (
        <div className="space-y-1.5">
          {clarifiers.map((c, ci) => (
            <p key={ci} className="pl-3 text-xs font-medium text-ink-soft" ref={styleRef({ borderLeft: `2px solid ${hexToRgba(posColor, 0.3)}` })}>
              {c.card_name}
              {c.reversed && <span className="text-danger-ink ml-1.5 font-normal">Reversed</span>}
              <span className="ml-1.5 font-normal" ref={styleRef({ color: hexToRgba(posColor, 0.6) })}>· {c.position}</span>
            </p>
          ))}
        </div>
      )}

      {/* Your meaning, then built-in text on request */}
      <MeaningsPanel cardId={card.card_id} orientation={card.reversed ? "reversed" : "upright"}>
        {clarifiers.map((c, ci) => {
          const data = TAROT_DECK.find((t) => t.id === c.card_id);
          const stock = data ? (c.reversed ? data.reversedMeaning : data.uprightMeaning) : null;
          if (!stock) return null;
          return (
            <div key={ci} className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-widest text-ink-faint">
                {c.card_name}{c.reversed ? " (reversed)" : ""} · {c.position}
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">{stock}</p>
            </div>
          );
        })}
      </MeaningsPanel>

      {/* Hiero: asks first, interprets only when asked. Only when this copy has a Claude key that works (never in Feathered). */}
      {readingContext && ai.claude && (
        <section aria-label="Hiero" className="border-t border-line pt-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => askAboutCard("questions")}
              disabled={busy}
              className="flex-1 text-xs bg-tone-800/60 hover:bg-tone-700/60 disabled:opacity-50 text-tone-200 font-medium py-2 px-3 rounded-lg transition-colors"
            >
              {hieroBusy === "questions" ? "Listening…" : <><SigilMark /> Ask me questions about this card</>}
            </button>
            <button
              onClick={() => askAboutCard("interpret")}
              disabled={busy}
              className="text-xs border border-line-strong hover:border-line-hover disabled:opacity-50 text-tone-300 py-2 px-3 rounded-lg transition-colors"
            >
              {hieroBusy === "interpret" ? "Reading…" : "Offer possible readings"}
            </button>
          </div>
          {hieroText && (
            <div className={proseClass}>
              <ReactMarkdown>{hieroText}</ReactMarkdown>
            </div>
          )}
          {saved && !hieroBusy && (
            <p className="text-xs text-success">Saved to this reading&apos;s journal ✓</p>
          )}

          {clarifiers.map((c, ci) => (
            <div key={ci} className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => askAboutClarifier(ci, "questions")}
                  disabled={busy}
                  className="flex-1 text-xs bg-tone-900/40 hover:bg-tone-800/40 disabled:opacity-50 text-tone-300 font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  {clarifierBusy === ci ? "Listening…" : <><SigilMark /> Ask me about {c.card_name}</>}
                </button>
                <button
                  onClick={() => askAboutClarifier(ci, "interpret")}
                  disabled={busy}
                  className="text-xs border border-line-strong hover:border-line-hover disabled:opacity-50 text-tone-400 py-2 px-3 rounded-lg transition-colors"
                >
                  Possible readings
                </button>
              </div>
              {clarifierText[ci] && (
                <div className={proseClass}>
                  <ReactMarkdown>{clarifierText[ci]}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
