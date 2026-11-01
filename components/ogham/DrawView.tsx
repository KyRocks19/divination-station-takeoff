"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDate, toISOString } from "@/lib/date";
import SkyLine from "@/components/SkyLine";
import DivinationJournal from "@/components/DivinationJournal";
import PredictionsPanel from "@/components/PredictionsPanel";
import CompanionPanel from "@/components/CompanionPanel";
import DivinationTags from "@/components/DivinationTags";
import GuessFirst from "@/components/GuessFirst";
import Reveal from "@/components/reveal/Reveal";
import { revealSpec } from "@/lib/reveal-core";
import { useGuess } from "@/components/useGuess";
import GuidePanel from "@/components/GuidePanel";
import { ShareToolReading } from "@/components/ShareReading";
import InterviewPanel from "@/components/InterviewPanel";
import AddToDay from "@/components/AddToDay";
import StaveGlyph from "@/components/ogham/StaveGlyph";
import StaveMeanings from "@/components/ogham/StaveMeanings";
import StaveNameEditor from "@/components/ogham/StaveNameEditor";
import { getStave } from "@/lib/ogham-data";
import { staveTitle } from "@/lib/stave-names-core";
import { useChosenTools } from "@/components/ChosenTools";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import type { OghamDraw } from "@/lib/ogham";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";


interface Props {
  initialDraw: OghamDraw;
  /** What the person has written about this draw so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the draw. */
  sky: Sky & { recorded: boolean };
  /** The person's own names for staves, by stave id. */
  initialNames: Record<string, string>;
  /** Whether the person shows the later names of the five later letters. */
  initialLaterNames: boolean;
}

/** One saved draw: when it was made, the question, each stave with the person's own words, and what they wrote. */
export default function DrawView({ initialDraw, initialEntries, sky, initialNames, initialLaterNames }: Props) {
  const router = useRouter();
  const questionId = useId();
  const laterId = useId();
  const hints = usePrefs().scaffolding === "more";
  const tools = useChosenTools();
  const api = `/api/ogham/${initialDraw.id}`;

  // An entry can start an oracle card only when the oracle deck is among the person's tools.
  const cardMaker = tools === null || tools.includes("oracle") ? { deckId: null } : undefined;

  const [draw, setDraw] = useState(initialDraw);
  // A single stave opens at once; with several, each opens on a press, so the page does not load them all.
  const [open, setOpen] = useState<Set<number>>(() => new Set(initialDraw.staves.length === 1 ? [0] : []));
  const { held } = useGuess(initialDraw.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraw.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [names, setNames] = useState(initialNames);
  const [showLater, setShowLater] = useState(initialLaterNames);
  const [laterError, setLaterError] = useState<string | null>(null);
  // The side switch is offered only when the draw holds one of the five later letters, the only staves with later names.
  const hasLater = draw.staves.some((s) => getStave(s.stave_id)?.laterName);

  async function chooseLater(on: boolean) {
    setShowLater(on);
    setLaterError(null);
    try {
      const res = await fetch("/api/ogham/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laterNames: on }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      if (saved.laterNames !== on) setLaterError("Shown for now, but the choice could not be kept for your next visit yet.");
    } catch {
      setLaterError("Shown for now, but the choice could not be saved.");
    }
  }

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: draft }),
      });
      if (!res.ok) throw new Error();
      setDraw(await res.json());
      setEditing(false);
    } catch {
      setError("Could not save. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraw() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/ogham");
    } catch {
      setError("Could not delete the draw. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href="/ogham">
        ← Ogham
      </BackLink>

      <header className="space-y-2">
        <h1 className="text-sm text-ink-faint uppercase tracking-widest">
          Drawn{" "}
          <time dateTime={toISOString(draw.created_at)} suppressHydrationWarning>
            {parseDate(draw.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </h1>
        <SkyLine sky={sky} />
        {draw.layout_name && <p className="text-xs text-ink-faint break-words">Layout: {draw.layout_name}</p>}
      </header>

      <section aria-label="Your question or intention">
        {editing ? (
          <form onSubmit={saveQuestion} className="space-y-3">
            <label htmlFor={questionId} className="block text-xs text-ink-faint">Your question or intention</label>
            <textarea
              id={questionId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              // The box opens from a button press, so the cursor goes straight into it.
              autoFocus
              className={`${fieldFullClass} resize-y leading-relaxed`}
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? "Saving…" : "Save"}</button>
              <button
                type="button"
                onClick={() => { setDraft(draw.question ?? ""); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : draw.question ? (
          <div className="space-y-1">
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{draw.question}</p>
            <button onClick={() => setEditing(true)} className={buttonClass.text}>Edit</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className={buttonClass.text}>Add a question or intention</button>
        )}
      </section>

      <GuessFirst divinationId={draw.id} />

      <Reveal divinationId={draw.id} question={draw.question} readingKey={`d${draw.id}`} createdAt={draw.created_at} spec={revealSpec("ogham")}>
        <section aria-label="The ogham" className={hasLater ? "space-y-4 md:space-y-0 md:grid md:grid-cols-[1fr_11rem] md:gap-6 md:items-start" : "space-y-4"}>
          {hasLater && (
            <div role="group" aria-label="Names" className="md:order-2 md:sticky md:top-4 bg-surface border border-line rounded-card p-3 space-y-1">
              <label htmlFor={laterId} className="flex items-start gap-2 text-sm text-ink-soft">
                <input id={laterId} type="checkbox" checked={showLater} onChange={(e) => chooseLater(e.target.checked)} className="mt-1" />
                Show the later names
              </label>
              <p className="text-xs text-ink-faint leading-relaxed">
                The names most modern divination books give the five later letters, such as Koad and Mor.
              </p>
              {laterError && <p className="text-xs text-danger" role="alert">{laterError}</p>}
            </div>
          )}
          <ol className="list-none p-0 space-y-4">
            {draw.staves.map((r, i) => {
              const title = staveTitle(r.stave_id, names[r.stave_id], showLater);
              return (
              <li key={`${r.stave_id}-${i}`} className="bg-surface border border-line rounded-card p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <StaveGlyph staveId={r.stave_id} className="w-10 h-16 flex-shrink-0 text-tone-200" />
                  <div className="min-w-0 flex-1">
                    {r.position_name && (
                      <p className="text-xs text-tone-400 uppercase tracking-widest break-words">{r.position_name}</p>
                    )}
                    <p className="text-xl font-bold text-tone-100 break-words">
                      {draw.staves.length > 1 && <span className="text-sm text-ink-ghost font-normal mr-2">{i + 1}.</span>}
                      {title.name}
                    </p>
                    {title.medieval && <p className="text-xs text-ink-muted break-words">Medieval name: {title.medieval}</p>}
                    {title.later && <p className="text-xs text-ink-muted break-words">Later name: {title.later}</p>}
                    {r.position_prompt && (
                      <p className="text-sm text-ink-muted italic leading-relaxed break-words mt-1">{r.position_prompt}</p>
                    )}
                  </div>
                  {draw.staves.length > 1 && !held && (
                    <button onClick={() => toggle(i)} aria-expanded={open.has(i)} className={buttonClass.text}>
                      {open.has(i) ? "Close" : "Your words"}
                    </button>
                  )}
                </div>
                {open.has(i) && !held && (
                  <>
                    <StaveNameEditor
                      staveId={r.stave_id}
                      name={names[r.stave_id] ?? null}
                      onSaved={(name) => setNames((prev) => {
                        const next = { ...prev };
                        if (name) next[r.stave_id] = name;
                        else delete next[r.stave_id];
                        return next;
                      })}
                    />
                    <StaveMeanings staveId={r.stave_id} />
                  </>
                )}
              </li>
              );
            })}
          </ol>
        </section>
      </Reveal>

      <DivinationTags divinationId={draw.id} />

      <DivinationJournal
        divinationId={draw.id}
        initialEntries={initialEntries}
        noun="draw"
        prompt="What do you make of this draw?"
        hint="You can come back to this draw later and write what happened. Reading your own words next to what followed is how your sense of the ogham sharpens."
        cardMaker={cardMaker}
        hints={hints}
      />

      <ShareToolReading
        reading={{ tool: "Ogham", question: draw.question ?? "", created_at: draw.created_at, lines: draw.staves.map((s) => `${s.position_name ? s.position_name + ": " : ""}${s.stave_name}`) }}
        entries={initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={draw.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={draw.id} /></div>
      <CompanionPanel divinationId={draw.id} />
      <div className="mt-4"><InterviewPanel divinationId={draw.id} /></div>
      <div className="mt-4"><GuidePanel divinationId={draw.id} /></div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/ogham/new" className={buttonClass.text}>Draw again</Link>
        <Link href="/ogham" className={buttonClass.text}>Past draws</Link>
        <Link href="/ogham/set" className={buttonClass.text}>The ogham letters</Link>
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete this draw and what you wrote about it? Your own meanings for the staves are not touched. This cannot be undone.{" "}
            <button onClick={deleteDraw} disabled={busy} className="text-danger-ink hover:text-danger-soft">
              {busy ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this draw</button>
        )}
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>
    </Page>
  );
}
