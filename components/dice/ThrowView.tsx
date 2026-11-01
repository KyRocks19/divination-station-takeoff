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
import DieFace from "@/components/dice/DieFace";
import FaceMeanings from "@/components/dice/FaceMeanings";
import DiceHistory from "@/components/dice/DiceHistory";
import { useChosenTools } from "@/components/ChosenTools";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import type { DiceThrow } from "@/lib/dice";
import { faceId, faceLabel, getObject, groupByObject, sideShape, tallyCoin, totalOf, type DiceObjectId } from "@/lib/dice-data";
import { withOwnName } from "@/lib/own-names-core";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";


interface Props {
  initialThrow: DiceThrow;
  /** What the person has written about this throw so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the throw. */
  sky: Sky & { recorded: boolean };
  /** The person's own names for pieces (a side of a knucklebone), by piece id. */
  ownNames?: Record<string, string>;
}

/** One saved throw: when it was made, the question, each die's own value with the total, and what the person wrote. */
export default function ThrowView({ initialThrow, initialEntries, sky, ownNames = {} }: Props) {
  const router = useRouter();
  const questionId = useId();
  const hints = usePrefs().scaffolding === "more";
  const tools = useChosenTools();
  const api = `/api/dice/${initialThrow.id}`;

  // An entry can start an oracle card only when the oracle deck is among the person's tools.
  const cardMaker = tools === null || tools.includes("oracle") ? { deckId: null } : undefined;

  const [thrown, setThrown] = useState(initialThrow);
  // A single result opens at once; with several, each opens on a press, so the page does not load them all.
  const [open, setOpen] = useState<Set<number>>(() => new Set(initialThrow.results.length === 1 ? [0] : []));
  const { held } = useGuess(initialThrow.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialThrow.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A throw can have several kinds of object. Totals and coin counts are worked out for each kind on its own.
  const groups = groupByObject(thrown.results);
  const mixed = groups.length > 1;
  const nameOf = (id: DiceObjectId) => getObject(id)?.name ?? id;
  const sums = groups
    .filter((g) => g.faces.length > 1)
    .map((g) => ({ ...g, total: totalOf(g.object, g.faces), coin: g.object === "coin" ? tallyCoin(g.faces) : null }))
    // A knucklebone's sides are only named, so there is nothing to add up or count for them.
    .filter((s) => s.total !== null || s.coin !== null);

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
      setThrown(await res.json());
      setEditing(false);
    } catch {
      setError("Could not save. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteThrow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/dice");
    } catch {
      setError("Could not delete the throw. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href="/dice">
        ← Dice and coins
      </BackLink>

      <header className="space-y-2">
        <h1 className="text-sm text-ink-faint uppercase tracking-widest">
          Thrown{" "}
          <time dateTime={toISOString(thrown.created_at)} suppressHydrationWarning>
            {parseDate(thrown.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </h1>
        <SkyLine sky={sky} />
        {thrown.layout_name && <p className="text-xs text-ink-faint break-words">Layout: {thrown.layout_name}</p>}
        <p className="text-xs text-ink-faint">{groups.map((g) => nameOf(g.object)).join(", ")}</p>
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
                onClick={() => { setDraft(thrown.question ?? ""); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : thrown.question ? (
          <div className="space-y-1">
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{thrown.question}</p>
            <button onClick={() => setEditing(true)} className={buttonClass.text}>Edit</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className={buttonClass.text}>Add a question or intention</button>
        )}
      </section>

      <GuessFirst divinationId={thrown.id} />

      <Reveal divinationId={thrown.id} question={thrown.question} readingKey={`d${thrown.id}`} createdAt={thrown.created_at} spec={revealSpec("dice")}>
        <section aria-label="What came up" className="space-y-4">
          <ol className="list-none p-0 space-y-4">
            {thrown.results.map((r, i) => (
              <li key={i} className="bg-surface border border-line rounded-card p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <DieFace object={r.object} face={r.face} className="w-16 h-16 flex-shrink-0 text-tone-200" />
                  <div className="min-w-0 flex-1">
                    {mixed && <p className="text-xs text-ink-faint break-words">{nameOf(r.object)}</p>}
                    {r.position_name && (
                      <p className="text-xs text-tone-400 uppercase tracking-widest break-words">{r.position_name}</p>
                    )}
                    <p className="text-xl font-bold text-tone-100 break-words">
                      {thrown.results.length > 1 && <span className="text-sm text-ink-ghost font-normal mr-2">{i + 1}.</span>}
                      {withOwnName(faceLabel(r.face), ownNames[faceId(r.object, r.face)])}
                    </p>
                    {r.object === "knucklebone" && <p className="text-xs text-ink-muted">{sideShape(r.face)}</p>}
                    {r.position_prompt && (
                      <p className="text-sm text-ink-muted italic leading-relaxed break-words mt-1">{r.position_prompt}</p>
                    )}
                  </div>
                  {thrown.results.length > 1 && !held && (
                    <button onClick={() => toggle(i)} aria-expanded={open.has(i)} className={buttonClass.text}>
                      {open.has(i) ? "Close" : "Your words"}
                    </button>
                  )}
                </div>
                {open.has(i) && !held && <FaceMeanings faceId={faceId(r.object, r.face)} />}
              </li>
            ))}
          </ol>

          {sums.length > 0 && (
            <ul className="list-none p-0 space-y-1 text-sm text-ink-soft break-words" aria-label="Totals">
              {sums.map((s) => (
                <li key={s.object}>
                  {mixed && <span className="text-ink-faint">{nameOf(s.object)}. </span>}
                  {s.total !== null ? (
                    <>
                      Total: {s.faces.length <= 20 ? `${s.faces.join(" + ")} = ` : ""}
                      <span className="text-tone-100 font-semibold">{s.total}</span>
                    </>
                  ) : s.coin ? (
                    <>Heads: {s.coin.heads} · Tails: {s.coin.tails}</>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      <DivinationTags divinationId={thrown.id} />

      <DivinationJournal
        divinationId={thrown.id}
        initialEntries={initialEntries}
        noun="throw"
        prompt="What do you make of this throw?"
        hint="You can come back to this throw later and write what happened. Reading your own words next to what followed is how your sense of your own dice sharpens."
        cardMaker={cardMaker}
        hints={hints}
      />

      <ShareToolReading
        reading={{ tool: "Dice and coins", question: thrown.question ?? "", created_at: thrown.created_at, lines: thrown.results.map((r) => `${r.position_name ? r.position_name + ": " : ""}${getObject(r.object)?.name ?? r.object}: ${faceLabel(r.face)}`) }}
        entries={initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={thrown.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={thrown.id} /></div>
      <CompanionPanel divinationId={thrown.id} />
      <div className="mt-4"><InterviewPanel divinationId={thrown.id} /></div>
      <div className="mt-4"><GuidePanel divinationId={thrown.id} /></div>

      <DiceHistory />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/dice/new" className={buttonClass.text}>Throw again</Link>
        <Link href="/dice" className={buttonClass.text}>Past throws</Link>
        <Link href="/dice/set" className={buttonClass.text}>What the faces mean to you</Link>
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete this throw and what you wrote about it? Your own meanings for the faces are not touched. This cannot be undone.{" "}
            <button onClick={deleteThrow} disabled={busy} className="text-danger-ink hover:text-danger-soft">
              {busy ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this throw</button>
        )}
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>
    </Page>
  );
}
