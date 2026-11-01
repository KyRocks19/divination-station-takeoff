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
import GuidePanel from "@/components/GuidePanel";
import { ShareToolReading } from "@/components/ShareReading";
import InterviewPanel from "@/components/InterviewPanel";
import AddToDay from "@/components/AddToDay";
import Surface from "@/components/scrying/Surface";
import { useChosenTools } from "@/components/ChosenTools";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import type { ScryingSession } from "@/lib/scrying";
import {
  isScryingSurface,
  MAX_SCRYING_MINUTES,
  minutesInWords,
  parseMinutesText,
  surfaceLabel,
} from "@/lib/scrying-surfaces";
import { buttonClass } from "@/components/ui/Button";
import { Field, fieldFullClass, Input } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";


interface Props {
  initialSession: ScryingSession;
  /** What the person has written about this session so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the session. */
  sky: Sky & { recorded: boolean };
}

/** One saved session: when it was, the surface, the question, and what the person wrote that they saw. */
export default function SessionView({ initialSession, initialEntries, sky }: Props) {
  const router = useRouter();
  const questionId = useId();
  const hints = usePrefs().scaffolding === "more";
  // An entry can start an oracle card only when the oracle deck is among the person's tools.
  const tools = useChosenTools();
  const cardMaker = tools === null || tools.includes("oracle") ? { deckId: null } : undefined;
  const api = `/api/scrying/${initialSession.id}`;

  const [session, setSession] = useState(initialSession);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialSession.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const timeId = useId();

  // Sends one change and takes the saved session back. Returns whether it worked.
  async function change(body: unknown, failure: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setSession(await res.json());
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (await change({ question: draft }, "Could not save. Your text is still here; try again.")) setEditing(false);
  }

  const timeBad = timeDraft.trim() !== "" && parseMinutesText(timeDraft) === null;

  async function saveTime(e: React.FormEvent) {
    e.preventDefault();
    const minutes = parseMinutesText(timeDraft);
    if (minutes === null) return;
    if (await change({ minutes }, "Could not save the time. Nothing changed; try again.")) setEditingTime(false);
  }

  async function deleteSession() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/scrying");
    } catch {
      setError("Could not delete the session. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href="/scrying">
        ← Scrying
      </BackLink>

      <header className="space-y-2">
        <h1 className="text-sm text-ink-faint uppercase tracking-widest">
          Looked{" "}
          <time dateTime={toISOString(session.created_at)} suppressHydrationWarning>
            {parseDate(session.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </h1>
        <SkyLine sky={sky} />
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
                onClick={() => { setDraft(session.question ?? ""); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : session.question ? (
          <div className="space-y-1">
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{session.question}</p>
            <button onClick={() => setEditing(true)} className={buttonClass.text}>Edit</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className={buttonClass.text}>Add a question or intention</button>
        )}
      </section>

      <GuessFirst divinationId={session.id} holdsMeanings={false} />

      <Reveal divinationId={session.id} question={session.question} readingKey={`d${session.id}`} createdAt={session.created_at} spec={revealSpec("scrying")}>
        <section aria-label="The surface" className="flex items-center gap-4">
          {isScryingSurface(session.surface) && (
            <Surface surface={session.surface} moving={false} className="w-20 h-20 flex-shrink-0" />
          )}
          <div className="space-y-1 min-w-0">
            <p className="text-xl font-bold text-tone-100">{surfaceLabel(session.surface)}</p>
            {editingTime ? (
              <form onSubmit={saveTime} className="space-y-2">
                <Field
                  htmlFor={timeId}
                  label="Minutes you looked"
                  hint="A whole number. The app only counted from opening the surface to pressing done; this is your own number."
                  error={timeBad ? `Type a whole number of minutes from 0 to ${MAX_SCRYING_MINUTES}.` : null}
                >
                  <Input
                    id={timeId}
                    wide={false}
                    className="w-24"
                    inputMode="numeric"
                    autoComplete="off"
                    // The box opens from a button press, so the cursor goes straight into it.
                    autoFocus
                    value={timeDraft}
                    onChange={(e) => setTimeDraft(e.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={busy || timeBad || timeDraft.trim() === ""} className={buttonClass.primary}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => { setEditingTime(false); setError(null); }} className={buttonClass.quiet}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : session.minutes !== null ? (
              <p className="text-xs text-ink-faint">
                You looked for {minutesInWords(session.minutes)}.{" "}
                <button
                  onClick={() => { setTimeDraft(String(session.minutes)); setEditingTime(true); }}
                  disabled={busy}
                  className={buttonClass.text}
                >
                  Change the time
                </button>{" "}
                <button
                  onClick={() => change({ minutes: null }, "Could not remove the time. Nothing changed.")}
                  disabled={busy}
                  className={buttonClass.danger}
                >
                  Remove the time
                </button>
              </p>
            ) : (
              <p>
                <button
                  onClick={() => { setTimeDraft(""); setEditingTime(true); }}
                  disabled={busy}
                  className={`${buttonClass.text} sm:inline-flex sm:items-center sm:min-h-6`}
                >
                  Add how long I looked
                </button>
              </p>
            )}
          </div>
        </section>
      </Reveal>

      <DivinationTags divinationId={session.id} />

      <DivinationJournal
        divinationId={session.id}
        initialEntries={initialEntries}
        noun="session"
        prompt="What did you see?"
        hint="You can come back to this session later and write what happened. Reading your own words next to what followed is how your sense of what you see sharpens."
        cardMaker={cardMaker}
        hints={hints}
      />

      <ShareToolReading
        reading={{ tool: "Scrying", question: session.question ?? "", created_at: session.created_at, lines: [surfaceLabel(session.surface)] }}
        entries={initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={session.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={session.id} /></div>
      <CompanionPanel divinationId={session.id} />
      <div className="mt-4"><InterviewPanel divinationId={session.id} /></div>
      <div className="mt-4"><GuidePanel divinationId={session.id} /></div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link
          href={isScryingSurface(session.surface) ? `/scrying/new?surface=${session.surface}` : "/scrying/new"}
          className={buttonClass.text}
        >
          Open a surface again
        </Link>
        <Link href="/scrying" className={buttonClass.text}>Past sessions</Link>
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete this session and what you wrote about it? This cannot be undone.{" "}
            <button onClick={deleteSession} disabled={busy} className="text-danger-ink hover:text-danger-soft">
              {busy ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this session</button>
        )}
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>
    </Page>
  );
}
