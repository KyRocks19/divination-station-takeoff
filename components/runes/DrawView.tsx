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
import RuneGlyph from "@/components/runes/RuneGlyph";
import RuneMeanings from "@/components/runes/RuneMeanings";
import { useChosenTools } from "@/components/ChosenTools";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import type { RuneDraw } from "@/lib/runes";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";


interface Props {
  initialDraw: RuneDraw;
  /** What the person has written about this draw so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the draw. */
  sky: Sky & { recorded: boolean };
}

/** One saved draw: when it was made, the question, each rune with the person's own words, and what they wrote. */
export default function DrawView({ initialDraw, initialEntries, sky }: Props) {
  const router = useRouter();
  const questionId = useId();
  const hints = usePrefs().scaffolding === "more";
  const tools = useChosenTools();
  const api = `/api/runes/${initialDraw.id}`;

  // An entry can start an oracle card only when the oracle deck is among the person's tools.
  const cardMaker = tools === null || tools.includes("oracle") ? { deckId: null } : undefined;

  const [draw, setDraw] = useState(initialDraw);
  // A single rune opens at once; with several, each opens on a press, so the page does not load them all.
  const [open, setOpen] = useState<Set<number>>(() => new Set(initialDraw.runes.length === 1 ? [0] : []));
  const { held } = useGuess(initialDraw.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraw.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      router.push("/runes");
    } catch {
      setError("Could not delete the draw. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href="/runes">
        ← Runes
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

      <Reveal divinationId={draw.id} question={draw.question} readingKey={`d${draw.id}`} createdAt={draw.created_at} spec={revealSpec("runes")}>
        <section aria-label="The runes" className="space-y-4">
          <ol className="list-none p-0 space-y-4">
            {draw.runes.map((r, i) => (
              <li key={`${r.rune_id}-${i}`} className="bg-surface border border-line rounded-card p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <RuneGlyph runeId={r.rune_id} reversed={r.reversed} className="w-10 h-16 flex-shrink-0 text-tone-200" />
                  <div className="min-w-0 flex-1">
                    {r.position_name && (
                      <p className="text-xs text-tone-400 uppercase tracking-widest break-words">{r.position_name}</p>
                    )}
                    <p className="text-xl font-bold text-tone-100 break-words">
                      {draw.runes.length > 1 && <span className="text-sm text-ink-ghost font-normal mr-2">{i + 1}.</span>}
                      {r.rune_name}
                    </p>
                    {r.reversed && <p className="text-xs text-danger-ink/80">Upside down</p>}
                    {r.position_prompt && (
                      <p className="text-sm text-ink-muted italic leading-relaxed break-words mt-1">{r.position_prompt}</p>
                    )}
                  </div>
                  {draw.runes.length > 1 && !held && (
                    <button onClick={() => toggle(i)} aria-expanded={open.has(i)} className={buttonClass.text}>
                      {open.has(i) ? "Close" : "Your words"}
                    </button>
                  )}
                </div>
                {open.has(i) && !held && <RuneMeanings runeId={r.rune_id} orientation={r.reversed ? "reversed" : "upright"} />}
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <DivinationTags divinationId={draw.id} />

      <DivinationJournal
        divinationId={draw.id}
        initialEntries={initialEntries}
        noun="draw"
        prompt="What do you make of this draw?"
        hint="You can come back to this draw later and write what happened. Reading your own words next to what followed is how your sense of the runes sharpens."
        cardMaker={cardMaker}
        hints={hints}
      />

      <ShareToolReading
        reading={{ tool: "Runes", question: draw.question ?? "", created_at: draw.created_at, lines: draw.runes.map((r) => `${r.position_name ? r.position_name + ": " : ""}${r.rune_name}${r.reversed ? " (upside down)" : ""}`) }}
        entries={initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={draw.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={draw.id} /></div>
      <CompanionPanel divinationId={draw.id} />
      <div className="mt-4"><InterviewPanel divinationId={draw.id} /></div>
      <div className="mt-4"><GuidePanel divinationId={draw.id} /></div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/runes/new" className={buttonClass.text}>Draw again</Link>
        <Link href="/runes" className={buttonClass.text}>Past draws</Link>
        <Link href="/runes/set" className={buttonClass.text}>The 24 runes</Link>
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete this draw and what you wrote about it? Your own meanings for the runes are not touched. This cannot be undone.{" "}
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
