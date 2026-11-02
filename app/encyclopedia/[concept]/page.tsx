"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { SUIT_META } from "@/lib/suit-meta";
import { SectionLabel } from "@/components/ui/Page";
import { ConceptNote } from "@/components/SensitiveMeanings";
import { useAiReady } from "@/components/AiReady";
import { SigilMark } from "@/components/ui/AppSigil";

interface CardEntry {
  id: string;
  name: string;
  suit: string;
  uprightMeaning: string;
  reversedMeaning: string;
  reversed: boolean;
}

interface ConceptData {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  /** What Hiero wrote for this person alone. */
  own_description?: string | null;
  cards: CardEntry[];
  related: { id: number; name: string; display_name: string; overlap: number }[];
  note: string | null;
}

function CardGrid({ cards, reversed }: { cards: CardEntry[]; reversed: boolean }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cards.map((card) => {
        const color = SUIT_META[card.suit]?.color ?? "#7c3aed";
        return (
          <Link
            key={card.id}
            href={`/cards/${encodeURIComponent(card.id)}`}
            className={`bg-surface rounded-lg px-3 py-2.5 transition-colors group border ${
              reversed
                ? "border-danger/10 hover:border-danger/40"
                : "border-line-faint hover:border-line-hover"
            }`}
          >
            <p className="text-sm font-medium text-ink-strong group-hover:text-tone-200 transition-colors">
              {card.name}
            </p>
            <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed text-ink-faint">
              {reversed ? card.reversedMeaning : card.uprightMeaning}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

export default function ConceptPage({
  params,
}: {
  params: Promise<{ concept: string }>;
}) {
  const { concept: encodedConcept } = use(params);
  const conceptName = decodeURIComponent(encodedConcept);
  const ai = useAiReady();

  const [data, setData] = useState<ConceptData | null>(null);
  const [description, setDescription] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [descError, setDescError] = useState("");
  const [ownDescription, setOwnDescription] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A name that is not a concept (a mistyped link, or a sensitive one this person has hidden) or a failed load ends the
  // "Loading…" line instead of leaving it there.
  const [missing, setMissing] = useState<"none" | "failed" | null>(null);

  useEffect(() => {
    const json = (r: Response) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    };
    fetch(`/api/encyclopedia/concepts`)
      .then(json)
      .then((all: any[]) => {
        const match = all.find((c) => c.name === conceptName);
        if (!match) {
          setMissing("none");
          return;
        }
        return fetch(`/api/encyclopedia/concepts/${match.id}`)
          .then(json)
          .then((d: ConceptData) => {
            setData(d);
            setDescription(d.own_description ?? d.description ?? "");
            setOwnDescription(Boolean(d.own_description));
            setNote(d.note ?? "");
          });
      })
      .catch(() => setMissing("failed"));
  }, [conceptName]);

  async function generateDescription() {
    if (!data || generating) return;
    setGenerating(true);
    setDescError("");
    setDescription("");
    const res = await fetch(`/api/encyclopedia/concepts/${data.id}/description`, {
      method: "POST",
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      setDescError(body?.error ?? "Hiero could not write this right now. Try again later.");
      setGenerating(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setDescription(acc);
    }
    setOwnDescription(true);
    setGenerating(false);
  }

  async function removeDescription() {
    if (!data) return;
    setDescError("");
    const res = await fetch(`/api/encyclopedia/concepts/${data.id}/description`, { method: "DELETE" });
    if (res.ok) {
      setDescription("");
      setOwnDescription(false);
    } else {
      setDescError("That could not be removed. Try again.");
    }
  }

  function onNoteChange(val: string) {
    setNote(val);
    setNoteSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNote(val), 1200);
  }

  async function saveNote(val: string) {
    if (!data) return;
    await fetch(`/api/encyclopedia/concepts/${data.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: val }),
    });
    setNoteSaved(true);
  }

  if (!data && missing) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-heading break-words">{conceptName}</h1>
        <p role="alert" className="text-sm text-ink-muted">
          {missing === "none"
            ? "There is no concept with this name in the encyclopedia."
            : "The concept could not be loaded. Nothing has changed; try again in a moment."}
        </p>
        <Link href="/encyclopedia" className="text-sm text-accent-ink hover:text-accent-ink-hover underline">← Encyclopedia</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-page mx-auto px-4 py-8">
        <p className="text-ink-ghost animate-pulse">Loading…</p>
      </div>
    );
  }

  const uprightCards = data.cards.filter((c) => !c.reversed);
  const reversedCards = data.cards.filter((c) => c.reversed);

  return (
    <div className="max-w-page mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <Link href="/encyclopedia" className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors">
          ← Encyclopedia Arcana
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-bold text-tone-200">{data.display_name}</h1>
          {uprightCards.length > 0 && reversedCards.length === 0 && (
            <span className="text-[10px] uppercase tracking-widest text-tone-500 border border-line-strong rounded px-1.5 py-0.5">Upright</span>
          )}
          {reversedCards.length > 0 && uprightCards.length === 0 && (
            <span className="text-[10px] uppercase tracking-widest text-danger border border-danger/20 rounded px-1.5 py-0.5">Reversed</span>
          )}
          {uprightCards.length > 0 && reversedCards.length > 0 && (
            <span className="text-[10px] uppercase tracking-widest text-ink-faint border border-line-faint rounded px-1.5 py-0.5">Upright + Reversed</span>
          )}
        </div>
        <p className="text-sm text-ink-faint">
          Appears in {data.cards.length} card{data.cards.length !== 1 ? "s" : ""}
          {uprightCards.length > 0 && reversedCards.length > 0 && (
            <span className="text-ink-ghost">
              {" "}({uprightCards.length} upright, {reversedCards.length} reversed)
            </span>
          )}
        </p>
      </div>

      <ConceptNote />

      {/* Description: written by Hiero for this person alone, on request */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel>About this concept</SectionLabel>
          {!description && !generating && ai.claude && (
            <button
              onClick={generateDescription}
              className="text-xs bg-tone-800/60 hover:bg-tone-700/60 text-tone-200 px-3 py-1 min-h-11 sm:min-h-6 rounded-lg transition-colors"
            >
              <SigilMark /> Ask Hiero to describe this
            </button>
          )}
          {generating && (
            <span role="status" className="text-xs text-tone-400 animate-pulse">Hiero is writing…</span>
          )}
        </div>
        {description ? (
          <>
            <div className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{description}</div>
            {ownDescription && !generating && (
              <p className="text-xs text-ink-faint">
                Written by Hiero, an AI, for you. Only you can see it, and it is not a prediction.{" "}
                <button onClick={removeDescription} className="text-accent-ink hover:text-accent-ink-hover underline min-h-6">
                  Remove it
                </button>
              </p>
            )}
          </>
        ) : (
          !generating && (
            <p className="text-sm text-ink-ghost italic">{ai.claude ? "No description yet. Hiero can write one for you; only you will see it." : "No description yet."}</p>
          )
        )}
        {descError && <p role="status" className="text-sm text-danger">{descError}</p>}
      </section>

      {/* Upright cards */}
      {uprightCards.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>
            Upright in
            <span className="ml-1.5 text-ink-ghost normal-case tracking-normal font-normal">
              {uprightCards.length} card{uprightCards.length !== 1 ? "s" : ""}
            </span>
          </SectionLabel>
          <CardGrid cards={uprightCards} reversed={false} />
        </section>
      )}

      {/* Reversed cards */}
      {reversedCards.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs text-danger uppercase tracking-widest">
            Reversed in
            <span className="ml-1.5 text-ink-ghost normal-case tracking-normal font-normal">
              {reversedCards.length} card{reversedCards.length !== 1 ? "s" : ""}
            </span>
          </h2>
          <CardGrid cards={reversedCards} reversed={true} />
        </section>
      )}

      {/* Related concepts */}
      {data.related.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Related concepts</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {data.related.map((r) => (
              <Link
                key={r.id}
                href={`/encyclopedia/${encodeURIComponent(r.name)}`}
                className="text-sm text-ink-muted hover:text-tone-300 transition-colors border border-line hover:border-line-hover rounded-lg px-3 py-1.5"
              >
                {r.display_name}
                <span className="text-xs text-ink-ghost ml-1.5">{r.overlap}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Your notes</SectionLabel>
          {noteSaved && <span role="status" className="text-xs text-success">Saved ✓</span>}
        </div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Your personal reflections on this concept…"
          rows={4}
          className="w-full bg-surface border border-line focus:border-focus text-sm text-ink-strong placeholder-ink-ghost rounded-lg px-4 py-3 resize-none focus:outline-none transition-colors"
        />
      </section>
    </div>
  );
}
