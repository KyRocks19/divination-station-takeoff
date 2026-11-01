"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDate, toISOString } from "@/lib/date";
import SkyLine from "@/components/SkyLine";
import DivinationJournal from "@/components/DivinationJournal";
import PredictionsPanel from "@/components/PredictionsPanel";
import CompanionPanel from "@/components/CompanionPanel";
import GuidePanel from "@/components/GuidePanel";
import InterviewPanel from "@/components/InterviewPanel";
import AddToDay from "@/components/AddToDay";
import { ShareToolReading } from "@/components/ShareReading";
import DivinationTags from "@/components/DivinationTags";
import GuessFirst from "@/components/GuessFirst";
import { GuessProvider } from "@/components/GuessGate";
import Reveal from "@/components/reveal/Reveal";
import type { RevealSpec } from "@/lib/reveal-core";
import type { TeaKind } from "@/lib/tea-core";
import { useChosenTools } from "@/components/ChosenTools";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";

interface Props {
  /** The shared record of the reading (`divinations`). */
  reading: { id: number; created_at: string; question: string | null };
  /** What the person has written about this reading so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the reading. */
  sky: Sky & { recorded: boolean };
  /** The tool's route for this reading, for example "/api/iching/12": PATCH changes the question, DELETE removes the reading. */
  api: string;
  /** Where the tool's list of readings is, and what to call it. */
  listHref: string;
  listLabel: string;
  /** "Cast", "Drawn", "Pulled": the word before the date. */
  madeWord: string;
  /** What one reading is called in the messages: "cast", "pull". */
  noun: string;
  journalPrompt: string;
  journalHint: string;
  /** Links under the reading: draw again, past readings, the set of pieces. */
  footerLinks: { href: string; label: string }[];
  /** The tool as it is named on screen, and what came up in words, one line each: for "Share this reading as text". */
  toolName: string;
  shareLines: string[];
  /** The sentence before the delete confirmation. */
  deleteNote: string;
  /** True for a tool the AI companion, the interviewer and the guide cannot read yet: their panels are left out. */
  plain?: boolean;
  /** The "write what you sense first" step: "meanings" when this tool's view has buttons that open meanings (they stay closed until the step is done), "plain" when it has none, "off" for a tool that has its own sealed first impression. */
  guess?: "meanings" | "plain" | "off";
  /** How the result opens: it stays covered until the "sense first" step is done or skipped, then opens after this animation (lib/reveal-core.ts). */
  reveal: RevealSpec;
  /** A tea-leaf reading's tea, for the colour of the brewing cup. */
  tea?: TeaKind | null;
  /** A few words to bring to mind while the reading opens (a tea's concepts). */
  focus?: string[];
  /** The result itself, drawn by the tool. */
  children: React.ReactNode;
}

/**
 * Everything a saved reading of the newer tools (I Ching, geomancy, bibliomancy) has in common, so each tool's own view is only its result: when it was
 * made and the sky then, the question (editable), the person's entries and predictions, add to a day, the companion, the interviewer, the guide, the
 * links and the delete. It follows components/runes/DrawView.tsx.
 */
export default function ReadingShell(p: Props) {
  const router = useRouter();
  const questionId = useId();
  const hints = usePrefs().scaffolding === "more";
  const guessMode = p.guess ?? "plain";
  const tools = useChosenTools();
  // An entry can start an oracle card only when the oracle deck is among the person's tools.
  const cardMaker = tools === null || tools.includes("oracle") ? { deckId: null } : undefined;

  const [question, setQuestion] = useState(p.reading.question);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.reading.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(p.api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: draft }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuestion(typeof data.question === "string" ? data.question : null);
      setEditing(false);
    } catch {
      setError("Could not save. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(p.api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push(p.listHref);
    } catch {
      setError(`Could not delete the ${p.noun}. Nothing was removed.`);
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href={p.listHref}>← {p.listLabel}</BackLink>

      <header className="space-y-2">
        <h1 className="text-sm text-ink-faint uppercase tracking-widest">
          {p.madeWord}{" "}
          <time dateTime={toISOString(p.reading.created_at)} suppressHydrationWarning>
            {parseDate(p.reading.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </h1>
        <SkyLine sky={p.sky} />
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
                onClick={() => { setDraft(question ?? ""); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : question ? (
          <div className="space-y-1">
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{question}</p>
            <button onClick={() => setEditing(true)} className={buttonClass.text}>Edit</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className={buttonClass.text}>Add a question or intention</button>
        )}
      </section>

      <DivinationTags divinationId={p.reading.id} />

      <GuessProvider divinationId={guessMode === "off" ? null : p.reading.id}>
        {guessMode !== "off" && <GuessFirst divinationId={p.reading.id} holdsMeanings={guessMode === "meanings"} />}
        <Reveal divinationId={guessMode === "off" ? null : p.reading.id} readingKey={`d${p.reading.id}`} createdAt={p.reading.created_at} spec={p.reveal} tea={p.tea} question={question} focus={p.focus}>
          {p.children}
        </Reveal>
      </GuessProvider>

      <DivinationJournal
        divinationId={p.reading.id}
        initialEntries={p.initialEntries}
        noun={p.noun}
        prompt={p.journalPrompt}
        hint={p.journalHint}
        cardMaker={cardMaker}
        hints={hints}
      />

      <ShareToolReading
        reading={{ tool: p.toolName, question: question ?? "", created_at: p.reading.created_at, lines: p.shareLines }}
        entries={p.initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={p.reading.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={p.reading.id} /></div>
      {!p.plain && (
        <>
          <CompanionPanel divinationId={p.reading.id} />
          <div className="mt-4"><InterviewPanel divinationId={p.reading.id} /></div>
          <div className="mt-4"><GuidePanel divinationId={p.reading.id} /></div>
        </>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {p.footerLinks.map((l) => (
          <Link key={l.href} href={l.href} className={buttonClass.text}>{l.label}</Link>
        ))}
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            {p.deleteNote} This cannot be undone.{" "}
            <button onClick={remove} disabled={busy} className="text-danger-ink hover:text-danger-soft">
              {busy ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this {p.noun}</button>
        )}
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>
    </Page>
  );
}
