"use client";

import { FEATHERED } from "@/lib/edition";
import { useState, useEffect, use, useId } from "react";
import { parseDate, toISOString } from "@/lib/date";
import { useRouter } from "next/navigation";
import SpreadLayout from "@/components/SpreadLayout";
import ClarifierDrawer from "@/components/ClarifierDrawer";
import CardDetail from "@/components/CardDetail";
import GuessFirst from "@/components/GuessFirst";
import Reveal from "@/components/reveal/Reveal";
import { revealSpec } from "@/lib/reveal-core";
import { useGuess } from "@/components/useGuess";
import SigilDisplay from "@/components/SigilDisplay";
import TagManager, { type Tag } from "@/components/TagManager";
import InterviewPanel from "@/components/InterviewPanel";
import SkyLine from "@/components/SkyLine";
import SpreadCorrespondences from "@/components/SpreadCorrespondences";
import type { Sky } from "@/lib/sky";
import Link from "next/link";
import PredictionsPanel from "@/components/PredictionsPanel";
import CompanionPanel from "@/components/CompanionPanel";
import AddToDay from "@/components/AddToDay";
import ShareReading from "@/components/ShareReading";
import ReactMarkdown from "react-markdown";
import { errorText } from "@/lib/ai-client";
import { SigilMark } from "@/components/ui/AppSigil";
import { Tabs } from "@/components/ui/Tabs";

interface DrawnCard { position: string; card_id: string; card_name: string; reversed: boolean; color?: string; }
interface Journal { id: number; reading_id: number; author: string; content: string; created_at: string; card_index?: number | null; clarifier_index?: number | null; kind?: string | null; }
interface Reading {
  id: number;
  spread_name: string;
  title: string;
  question: string;
  cards: DrawnCard[];
  clarifiers: Record<number, DrawnCard[]>;
  notes: string;
  created_at: string;
  /** The shared record the AI companion works from (null if the reading has none). */
  divination_id?: number | null;
  sky?: Sky & { recorded?: boolean };
  journals: Journal[];
}

export default function ReadingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const uid = useId();
  const [reading, setReading] = useState<Reading | null>(null);
  const [missing, setMissing] = useState<"none" | "failed" | null>(null);
  const guess = useGuess(reading?.divination_id);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [lookback, setLookback] = useState("");
  const [savingLookback, setSavingLookback] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<"spread" | "journals">("spread");
  // The two tabs are only on a phone; from 768 px both parts show side by side, and are then plain sections, not tab panels.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [interpretations, setInterpretations] = useState<Record<number, string>>({});
  const [clarifierInterpretations, setClarifierInterpretations] = useState<Record<number, Record<number, string>>>({});
  const [clarifiers, setClarifiers] = useState<Record<number, DrawnCard[]>>({});

  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [sigilData, setSigilData] = useState<string | null>(null);
  const [readingTags, setReadingTags] = useState<Tag[]>([]);

  const [guideResponse, setGuideResponse] = useState("");
  const [guideFetching, setGuideFetching] = useState(false);
  const [guideSaved, setGuideSaved] = useState(false);

  const [drawingClarifier, setDrawingClarifier] = useState(false);

  async function drawClarifier() {
    if (openIndex === null || drawingClarifier || !reading) return;
    setDrawingClarifier(true);
    try {
      const res = await fetch("/api/clarifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading_id: reading.id, card_index: openIndex }),
      });
      if (!res.ok) return;
      const newCard: DrawnCard = await res.json();
      setClarifiers((prev) => ({ ...prev, [openIndex]: [...(prev[openIndex] ?? []), newCard] }));
    } finally {
      setDrawingClarifier(false);
    }
  }

  async function askGuide() {
    if (guideFetching) return;
    setGuideResponse("");
    setGuideSaved(false);
    setGuideFetching(true);
    let accumulated = "";
    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading_id: Number(id) }),
      });
      if (!res.ok || !res.body) { setGuideResponse(await errorText(res, "Something went wrong. Try again.")); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGuideResponse(accumulated);
      }
    } catch {
      setGuideResponse("Something went wrong. Try again.");
    } finally {
      setGuideFetching(false);
    }
  }

  async function saveGuideEntry() {
    if (!guideResponse || guideSaved) return;
    await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_id: Number(id), author: "guide", content: guideResponse }),
    });
    setGuideSaved(true);
    load();
  }

  function stripJournalHeader(content: string): string {
    // Strip the bold header line added when saving: "**Card Name — Position**\n\n..."
    return content.startsWith("**") ? content.replace(/^\*\*[^\n]+\*\*\n\n/, "") : content;
  }

  async function load() {
    const res = await fetch(`/api/readings/${id}`).catch(() => null);
    // A reading that is not there (deleted, or not this person's) or a failed load ends the loading mark instead of leaving it.
    if (!res || !res.ok) setMissing(res?.status === 404 ? "none" : "failed");
    if (res?.ok) {
      setMissing(null);
      const data: Reading = await res.json();
      // A reading saved without a title, question or notes comes back with null for them; the page and its share panel expect text.
      setReading({ ...data, title: data.title ?? "", question: data.question ?? "", notes: data.notes ?? "" });
      setClarifiers(data.clarifiers ?? {});

      // Rebuild per-card interpretation maps from saved hiero journals.
      // Journals are ASC order so we overwrite — last entry wins (most recent).
      const interpMap: Record<number, string> = {};
      const clarifierInterpMap: Record<number, Record<number, string>> = {};
      for (const j of data.journals) {
        if (j.author === "hiero" && j.card_index != null) {
          const body = stripJournalHeader(j.content);
          if (j.clarifier_index != null) {
            if (!clarifierInterpMap[j.card_index]) clarifierInterpMap[j.card_index] = {};
            clarifierInterpMap[j.card_index][j.clarifier_index] = body;
          } else {
            interpMap[j.card_index] = body;
          }
        }
      }
      setInterpretations(interpMap);
      setClarifierInterpretations(clarifierInterpMap);
    }
  }

  async function reloadJournals() {
    const res = await fetch(`/api/readings/${id}`);
    if (res.ok) {
      const data = await res.json();
      setReading((r) => r ? { ...r, journals: data.journals } : r);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/insights")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.cardCounts) setCardCounts(d.cardCounts); })
      .catch(() => {});
    fetch("/api/sigil")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.sigil_data) setSigilData(d.sigil_data); })
      .catch(() => {});
    fetch(`/api/readings/${id}/tags`)
      .then((r) => r.ok ? r.json() : [])
      .then(setReadingTags)
      .catch(() => {});
  }, [id]);

  async function saveNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_id: Number(id), author: "user", content: newNote }),
    });
    setNewNote("");
    setSavingNote(false);
    load();
  }

  async function saveLookback() {
    if (!lookback.trim()) return;
    setSavingLookback(true);
    await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_id: Number(id), author: "user", kind: "lookback", content: lookback }),
    });
    setLookback("");
    setSavingLookback(false);
    load();
  }

  async function deleteJournal(jid: number) {
    await fetch(`/api/journals/${jid}`, { method: "DELETE" });
    load();
  }

  async function deleteReading() {
    setDeleting(true);
    await fetch(`/api/readings/${id}`, { method: "DELETE" });
    router.push("/readings");
  }

  function handleToggle(i: number) {
    setOpenIndex((prev) => (prev === i ? null : i));
  }

  if (!reading && missing) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold text-heading">Reading</h1>
      <p role="alert" className="text-sm text-ink-muted">
        {missing === "none"
          ? "This reading is not here. It may have been deleted."
          : "The reading could not be loaded. Nothing has changed; try again in a moment."}
      </p>
      <Link href="/readings" className="text-sm text-accent-ink hover:text-accent-ink-hover underline">← Readings</Link>
    </div>
  );

  if (!reading) return (
    <div role="status" aria-label="Loading reading" className="min-h-dvh flex items-center justify-center">
      <h1 className="sr-only">Reading</h1>
      <div aria-hidden="true" className="text-tone-400 text-2xl animate-pulse"><SigilMark /></div>
    </div>
  );

  const selectedCard = openIndex !== null ? reading.cards[openIndex] : null;

  const tabSpreadId = `${uid}-tab-spread`;
  const tabJournalsId = `${uid}-tab-journals`;
  const panelSpreadId = `${uid}-panel-spread`;
  const panelJournalsId = `${uid}-panel-journals`;
  const newNoteId = `${uid}-new-note`;
  const lookbackId = `${uid}-lookback`;
  const daysSinceReading = Math.floor((Date.now() - parseDate(reading.created_at).getTime()) / 86_400_000);
  const lookbacks = reading.journals.filter((j) => j.kind === "lookback");

  function authorName(j: Journal): string {
    if (j.author === "hiero" || j.author === "claude") return "Hiero";
    if (j.author === "guide") return "Your Guide";
    // The Sword button was removed on 2026-10-17; the entries it wrote stay, under a neutral name.
    if (j.author === "sword") return "Earlier AI entry";
    if (j.author === "interview") return "Hiero — Interview";
    if (j.kind === "impression") {
      const about = j.card_index != null ? reading!.cards[j.card_index]?.card_name : null;
      return about ? `You — what you saw in ${about}` : "You — first impression";
    }
    if (j.kind === "lookback") {
      const days = Math.floor((parseDate(j.created_at).getTime() - parseDate(reading!.created_at).getTime()) / 86_400_000);
      return `You — looking back${days > 0 ? `, ${days} day${days !== 1 ? "s" : ""} later` : ""}`;
    }
    return "You";
  }

  return (
    <div className="max-w-3xl md:max-w-6xl mx-auto px-4 py-4 sm:py-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/readings"
            aria-label="Back to readings list"
            className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-tone-400 transition-colors"
          >
            ← Readings
          </Link>
          <div className="flex items-start gap-3 mt-1">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-heading">
                {reading.title || reading.spread_name}
              </h1>
              <p className="text-xs text-tone-500 mt-1">
                {reading.spread_name} · <time dateTime={toISOString(reading.created_at)}>{parseDate(reading.created_at).toLocaleString()}</time>
              </p>
              {reading.sky && <SkyLine sky={reading.sky} className="mt-1" />}
              {reading.question && (
                <p className="text-ink-muted text-sm mt-1 italic">&ldquo;{reading.question}&rdquo;</p>
              )}
              <TagManager
                entityType="reading"
                entityId={reading.id}
                initialTags={readingTags}
                className="mt-2"
              />
            </div>
            {sigilData && (
              <SigilDisplay sigilData={sigilData} size={40} className="flex-shrink-0 mt-0.5" />
            )}
          </div>
        </div>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="text-xs text-danger hover:text-danger-ink border border-danger/25 rounded px-3 py-1.5 min-h-11 sm:min-h-0 transition-colors whitespace-nowrap"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2" role="group" aria-label="Confirm deletion">
            <span className="text-xs text-ink-muted whitespace-nowrap">Delete this reading?</span>
            <button
              onClick={deleteReading}
              disabled={deleting}
              className="text-xs text-danger hover:text-danger-soft border border-danger/60 rounded px-2 py-1.5 transition-colors whitespace-nowrap"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-ink-faint hover:text-ink-soft border border-line-strong rounded px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Tab bar — mobile only */}
      <Tabs
        label="Reading sections"
        className="mt-5 md:hidden"
        active={activeTab}
        onChange={setActiveTab}
        tabId={(t) => (t === "spread" ? tabSpreadId : tabJournalsId)}
        panelId={(t) => (t === "spread" ? panelSpreadId : panelJournalsId)}
        tabs={[
          { id: "spread", label: "Reading Spread" },
          {
            id: "journals",
            label: "Journals & Notes",
            badge: reading.journals.length > 0
              ? { text: String(reading.journals.length), label: `${reading.journals.length} journal entr${reading.journals.length !== 1 ? "ies" : "y"}` }
              : undefined,
          },
        ]}
      />

      {/* Desktop: border below header instead of tabs */}
      <div aria-hidden="true" className="hidden md:block border-b border-line-strong mt-5" />

      {/* Content — stacked on mobile, side-by-side on desktop */}
      <div className="md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start md:pt-6">

        {/* ── Spread panel ── */}
        <div
          id={panelSpreadId}
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : tabSpreadId}
          className={`space-y-4 pt-4 md:pt-0 ${activeTab !== "spread" ? "hidden" : ""} md:block`}
        >
          <h2 className="hidden md:block text-xs text-ink-muted uppercase tracking-widest mb-3">Reading Spread</h2>

          <GuessFirst divinationId={reading.divination_id} />

          <Reveal divinationId={reading.divination_id} question={reading.question} readingKey={`t${reading.id}`} createdAt={reading.created_at} spec={revealSpec("tarot")}>
            <section aria-label="Spread layout" className="-mx-4 md:mx-0 px-4 md:px-0">
              <SpreadLayout
                cards={reading.cards}
                spreadName={reading.spread_name}
                openIndex={openIndex}
                onToggle={handleToggle}
              />
            </section>

            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {selectedCard
                ? `${selectedCard.card_name}${selectedCard.reversed ? " (Reversed)" : " (Upright)"}, ${selectedCard.position} — card details shown`
                : "No card selected"}
            </div>
            <ClarifierDrawer
              cards={reading.cards}
              clarifiers={clarifiers}
              openIndex={openIndex}
              onSelectCard={handleToggle}
              onDrawClarifier={openIndex !== null ? drawClarifier : undefined}
              drawingClarifier={drawingClarifier}
            />
            {selectedCard && openIndex !== null && guess.held && (
              <p className="text-sm text-ink-muted" role="status">
                The details of this card open once you have written what you sense, or skipped that step.
              </p>
            )}
            {selectedCard && openIndex !== null && !guess.held && (
              <CardDetail
                key={`${openIndex}-${(clarifiers[openIndex] ?? []).length}`}
                card={selectedCard}
                readingContext={{ reading_id: reading.id, card_index: openIndex, onSaveJournal: reloadJournals }}
                impressions={reading.journals.filter(
                  (j) => j.kind === "impression" && j.card_index === openIndex && j.clarifier_index == null
                )}
                savedInterpretation={interpretations[openIndex] ?? ""}
                onInterpretationSaved={(text) =>
                  setInterpretations((prev) => ({ ...prev, [openIndex]: text }))
                }
                savedClarifiers={clarifiers[openIndex] ?? []}
                onClarifiersChanged={(updated) =>
                  setClarifiers((prev) => ({ ...prev, [openIndex]: updated }))
                }
                savedClarifierInterpretations={clarifierInterpretations[openIndex] ?? {}}
                onClarifierInterpretationSaved={(ci, text) =>
                  setClarifierInterpretations((prev) => ({
                    ...prev,
                    [openIndex]: { ...(prev[openIndex] ?? {}), [ci]: text },
                  }))
                }
                totalDrawCount={cardCounts[selectedCard.card_id]}
                onClose={() => setOpenIndex(null)}
              />
            )}

            {/* Element balance and shared numbers hint at meanings, so they wait for "write what you sense first" too (GF1 g). */}
            {!guess.held && <SpreadCorrespondences cards={reading.cards} />}
          </Reveal>

          <ShareReading
            reading={{ ...reading, clarifiers }}
            entries={reading.journals.map((j) => ({
              id: j.id,
              label: authorName(j),
              content: j.content,
              when: parseDate(j.created_at).toLocaleDateString(),
            }))}
          />

          {/* ── Interview ── */}
          <InterviewPanel readingId={reading.id} onSave={reloadJournals} />

        </div>

        {/* ── Journals & Notes panel ── */}
        <div
          id={panelJournalsId}
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : tabJournalsId}
          className={`space-y-4 pt-4 md:pt-0 ${activeTab !== "journals" ? "hidden" : ""} md:block md:border-l md:border-line md:pl-8`}
        >
          <h2 className="hidden md:block text-xs text-ink-muted uppercase tracking-widest mb-3">Journals & Notes</h2>

          {reading.notes && (
            <section aria-label="Reading notes" className="bg-surface border border-line rounded-card p-4">
              <h3 className="text-xs text-ink-faint uppercase tracking-widest mb-2">Reading Notes</h3>
              <p className="text-sm text-ink-soft whitespace-pre-wrap">{reading.notes}</p>
            </section>
          )}

          <PredictionsPanel readingId={reading.id} />

          {reading.divination_id != null && (
            <>
              <AddToDay kind="reading" refId={reading.divination_id} />
              <CompanionPanel divinationId={reading.divination_id} />
            </>
          )}

          <section aria-label="Journal entries" className="space-y-4">
            <h3 className="text-xs text-ink-faint uppercase tracking-widest">
              Journals
              {reading.journals.length > 0 && (
                <span
                  aria-label={`${reading.journals.length} entr${reading.journals.length !== 1 ? "ies" : "y"}`}
                  className="ml-2 bg-tone-900/50 text-tone-500 text-xs rounded-full px-1.5 py-0.5"
                >
                  {reading.journals.length}
                </span>
              )}
            </h3>

            {reading.journals.length === 0 && (
              <p className="text-sm text-ink-ghost">No journal entries yet.</p>
            )}

            {reading.journals.map((j) => (
              <article
                key={j.id}
                aria-label={`Journal entry by ${j.author === "hiero" || j.author === "claude" ? "Hiero" : j.author === "guide" ? "your guide" : j.author === "sword" ? "an earlier AI entry" : j.author === "interview" ? "Hiero Interview" : "you"}, ${parseDate(j.created_at).toLocaleString()}`}
                className={`bg-surface border rounded-xl p-4 space-y-2 ${
                  j.author === "hiero" || j.author === "claude" ? "border-line-strong" : j.author === "guide" ? "border-tone-700/40" : j.author === "sword" ? "border-line-strong" : j.author === "interview" ? "border-danger/30" : j.kind === "lookback" ? "border-success/30" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-widest ${
                    j.author === "hiero" || j.author === "claude" ? "text-tone-400" : j.author === "guide" ? "text-tone-400" : j.author === "sword" ? "text-tone-400" : j.author === "interview" ? "text-danger-ink" : j.kind === "lookback" ? "text-success" : "text-tone-400"
                  }`}>
                    <span aria-hidden="true">{j.author === "hiero" || j.author === "claude" || j.author === "guide" || j.author === "sword" || j.author === "interview" ? <><SigilMark />{" "}</> : ""}</span>
                    {authorName(j)}
                  </span>
                  <div className="flex items-center gap-3">
                    <time dateTime={toISOString(j.created_at)} className="text-xs text-ink-ghost">
                      {parseDate(j.created_at).toLocaleString()}
                    </time>
                    <button
                      onClick={() => deleteJournal(j.id)}
                      aria-label={`Delete journal entry from ${parseDate(j.created_at).toLocaleString()}`}
                      className="text-xs text-ink-ghost hover:text-danger-ink transition-colors"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                </div>
                <div className="text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 prose-strong:text-tone-300 prose-em:text-tone-300 prose-headings:text-tone-300">
                  <ReactMarkdown>{j.content}</ReactMarkdown>
                </div>
                <AddToDay kind="journal_entry" refId={j.id} />
              </article>
            ))}

            <div className="bg-surface border border-line-faint rounded-xl p-4 space-y-3">
              <label htmlFor={newNoteId} className="block text-xs text-ink-faint uppercase tracking-widest">Add your note</label>
              <textarea
                id={newNoteId}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write your reflections…"
                rows={4}
                className="w-full bg-field border border-line-strong rounded-control px-3 py-2 min-h-11 sm:min-h-0 text-sm text-ink-strong placeholder-ink-ghost focus:border-focus resize-none"
              />
              <button
                onClick={saveNote}
                disabled={savingNote || !newNote.trim()}
                className="bg-blush hover:bg-blush-soft disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
              >
                {savingNote ? "Saving…" : "Save Note"}
              </button>
            </div>

            {/* Look back */}
            <div className="bg-surface border border-success/20 rounded-xl p-4 space-y-3">
              <label htmlFor={lookbackId} className="block text-xs text-success uppercase tracking-widest">
                Looking back
              </label>
              <p className="text-xs text-ink-faint">
                {daysSinceReading < 1
                  ? "Come back to this reading later and write what happened. Reading your own words next to what followed is how your sense of the cards sharpens."
                  : `This reading was ${daysSinceReading} day${daysSinceReading !== 1 ? "s" : ""} ago. What happened afterwards? How does it sit next to what you wrote then?`}
                {lookbacks.length > 0 && ` You have looked back ${lookbacks.length} time${lookbacks.length !== 1 ? "s" : ""}.`}
              </p>
              <textarea
                id={lookbackId}
                value={lookback}
                onChange={(e) => setLookback(e.target.value)}
                placeholder="What happened afterwards…"
                rows={3}
                className="w-full bg-canvas border border-success/25 rounded-lg px-3 py-2 text-sm text-ink-strong placeholder-ink-ghost focus:border-success resize-none"
              />
              <button
                onClick={saveLookback}
                disabled={savingLookback || !lookback.trim()}
                className="bg-success hover:bg-success-ink disabled:opacity-40 text-canvas text-sm font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
              >
                {savingLookback ? "Saving…" : "Save look-back"}
              </button>
            </div>

            {/* Guide section (Claude), not in the Feathered edition */}
            {!FEATHERED && (
            <div className="bg-surface-sunken border border-tone-900/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-tone-400/80 uppercase tracking-widest"><SigilMark /> Your Guide</p>
                {guideResponse && !guideFetching && (
                  <div className="flex items-center gap-3">
                    {!guideSaved && (
                      <button onClick={saveGuideEntry} className="text-xs text-tone-400 hover:text-tone-300 transition-colors">
                        Save to journal
                      </button>
                    )}
                    {guideSaved && <span role="status" className="text-xs text-success">Saved ✓</span>}
                    <button onClick={() => { setGuideResponse(""); setGuideSaved(false); }} className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {!guideResponse && (
                <button
                  onClick={askGuide}
                  disabled={guideFetching}
                  className="w-full text-xs bg-tone-900/30 hover:bg-tone-800/30 disabled:opacity-50 text-tone-300 font-medium py-2 px-3 rounded-lg transition-colors border border-tone-800/30"
                >
                  {guideFetching ? "Listening…" : "What wants to emerge?"}
                </button>
              )}

              {guideFetching && !guideResponse && (
                <p className="text-xs text-tone-400/60 animate-pulse text-center">Your guide is present…</p>
              )}

              {guideResponse && (
                <div className="text-sm text-ink-soft leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 prose-strong:text-tone-300 prose-em:text-tone-200 prose-headings:text-tone-300">
                  <ReactMarkdown>{guideResponse}</ReactMarkdown>
                </div>
              )}

              {guideResponse && !guideFetching && (
                <button
                  onClick={askGuide}
                  className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors"
                >
                  Ask again
                </button>
              )}
            </div>
            )}
          </section>
        </div>

      </div>
    </div>
  );
}
