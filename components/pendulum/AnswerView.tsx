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
import PendulumBoard from "@/components/pendulum/PendulumBoard";
import { useChosenTools } from "@/components/ChosenTools";
import { usePrefs } from "@/components/usePrefs";
import type { Sky } from "@/lib/sky";
import type { DivinationEntry } from "@/lib/divinations";
import type { PendulumAnswer } from "@/lib/pendulum";
import { swingWords, wordingChange } from "@/lib/pendulum-swings";
import { motionWords } from "@/lib/pendulum-motion";
import PendulumSpeed, { usePendulumSpeed } from "@/components/pendulum/PendulumSpeed";
import { buttonClass } from "@/components/ui/Button";
import { fieldFullClass } from "@/components/ui/Field";
import { BackLink, Page } from "@/components/ui/Page";


interface Props {
  initialAnswer: PendulumAnswer;
  /** The person's words for this swing as they are today; null when the swing has been deleted. */
  swingNow: { meaning: string | null; earlierCount: number } | null;
  /** What the person has written about this answer so far. */
  initialEntries: DivinationEntry[];
  /** The sky recorded with the answer. */
  sky: Sky & { recorded: boolean };
}

/**
 * Shows, without any judgement, how the person's words for this swing stand today compared with when this was asked.
 * Words change over a life; the page only sets the two side by side. Nothing is shown when they are the same.
 */
function WordingSince({ then, now, earlierCount }: { then: string | null; now: string | null; earlierCount: number }) {
  const change = wordingChange(then, now);
  if (change === null) return null;
  return (
    <div className="border-t border-line-faint pt-3 space-y-2">
      <h3 className="text-[10px] text-ink-faint uppercase tracking-widest">Your words for this swing today</h3>
      {change === "cleared" ? (
        <p className="text-sm text-ink-ghost italic">You have since cleared what this swing means. The wording above is kept here.</p>
      ) : (
        <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{now}</p>
      )}
      <p className="text-xs text-ink-faint">
        {change === "added" && "When you asked, you had not written anything for this swing."}
        {change === "changed" && "You have written this swing differently since you asked."}
        {earlierCount > 0 && ` Your earlier wordings are kept on the swing (${earlierCount}).`}
      </p>
    </div>
  );
}

/** One saved answer: when it was asked, the question, the swing, the person's own words for it, and what they wrote. */
export default function AnswerView({ initialAnswer, swingNow, initialEntries, sky }: Props) {
  const router = useRouter();
  const { held } = useGuess(initialAnswer.id);
  const [speedId, setSpeedId, speed] = usePendulumSpeed();
  const questionId = useId();
  const hints = usePrefs().scaffolding === "more";
  const tools = useChosenTools();
  const api = `/api/pendulum/${initialAnswer.id}`;

  // An entry can start an oracle card only when the oracle deck is among the person's tools.
  const cardMaker = tools === null || tools.includes("oracle") ? { deckId: null } : undefined;

  const [answer, setAnswer] = useState(initialAnswer);
  const [moving, setMoving] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialAnswer.question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setAnswer(await res.json());
      setEditing(false);
    } catch {
      setError("Could not save. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnswer() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/pendulum");
    } catch {
      setError("Could not delete the answer. Nothing was removed.");
      setBusy(false);
    }
  }

  return (
    <Page>
      <BackLink href="/pendulum">
        ← Pendulum
      </BackLink>

      <header className="space-y-2">
        <h1 className="text-sm text-ink-faint uppercase tracking-widest">
          Asked{" "}
          <time dateTime={toISOString(answer.created_at)} suppressHydrationWarning>
            {parseDate(answer.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
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
                onClick={() => { setDraft(answer.question ?? ""); setEditing(false); setError(null); }}
                className={buttonClass.quiet}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : answer.question ? (
          <div className="space-y-1">
            <p className="text-base text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{answer.question}</p>
            <button onClick={() => setEditing(true)} className={buttonClass.text}>Edit</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className={buttonClass.text}>Add a question or intention</button>
        )}
      </section>

      <DivinationTags divinationId={answer.id} />

      <GuessFirst divinationId={answer.id} />

      <Reveal divinationId={answer.id} question={answer.question} readingKey={`d${answer.id}`} createdAt={answer.created_at} spec={revealSpec("pendulum", { random: answer.chosen_by === "chance" })}>
        <section aria-label="The swing" className="space-y-3 text-center">
          {/* Sized by the window's height, so the writing below is not pushed far down. */}
          <PendulumBoard
            shape={answer.shape}
            angle={answer.angle}
            label={answer.swing_name}
            moving={moving}
            speed={speed}
            className="mx-auto w-full max-w-[min(45vh,24rem)] h-auto"
          />
          <p className="text-2xl font-bold text-tone-100 break-words">{answer.swing_name}</p>
          <p className="text-xs text-ink-faint">{swingWords(answer)}</p>
          {answer.chosen_by === "motion" && (
            <p className="text-xs text-ink-faint">
              Chosen by your phone&rsquo;s movement ({motionWords(answer.motion_shape, answer.motion_angle)}), matched to this swing.
              Chance did not pick it.
            </p>
          )}
          {answer.shape !== "still" && (
            <div className="space-y-3">
              <p>
                <button onClick={() => setMoving((m) => !m)} className={buttonClass.text} aria-pressed={!moving}>
                  {moving ? "Hold it still" : "Let it move"}
                </button>
              </p>
              <PendulumSpeed value={speedId} onChange={setSpeedId} />
            </div>
          )}
        </section>

        {!held && (
        <section aria-label="Your words for this swing" className="bg-surface border border-line rounded-card p-5 space-y-2">
          <h2 className="text-[10px] text-ink-faint uppercase tracking-widest">What this swing meant to you when you asked</h2>
          {answer.meaning ? (
            <p className="text-sm text-ink-strong leading-relaxed whitespace-pre-wrap break-words">{answer.meaning}</p>
          ) : (
            <p className="text-sm text-ink-ghost italic">You had not written what this swing means.</p>
          )}
          {answer.swing_id === null || swingNow === null ? (
            <p className="text-xs text-ink-faint">This swing has since been deleted. Its name and your words are kept here.</p>
          ) : (
            <>
              <WordingSince then={answer.meaning} now={swingNow.meaning} earlierCount={swingNow.earlierCount} />
              <p>
                <Link href="/pendulum/swings" className={buttonClass.text}>Your swings</Link>
              </p>
            </>
          )}
        </section>
        )}
      </Reveal>

      <DivinationJournal
        divinationId={answer.id}
        initialEntries={initialEntries}
        noun="answer"
        prompt="What do you make of this answer?"
        hint="You can come back to this answer later and write what happened. Reading your own words next to what followed is how your sense of your own pendulum sharpens."
        cardMaker={cardMaker}
        hints={hints}
      />

      <ShareToolReading
        reading={{ tool: "Pendulum", question: answer.question ?? "", created_at: answer.created_at, lines: [answer.swing_name] }}
        entries={initialEntries.map((e) => ({ id: e.id, label: "You", content: e.content, when: parseDate(e.created_at).toLocaleDateString() }))}
      />

      <PredictionsPanel divinationId={answer.id} />

      <div className="mt-4"><AddToDay kind="reading" refId={answer.id} /></div>
      <CompanionPanel divinationId={answer.id} />
      <div className="mt-4"><InterviewPanel divinationId={answer.id} /></div>
      <div className="mt-4"><GuidePanel divinationId={answer.id} /></div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/pendulum/new" className={buttonClass.text}>Ask again</Link>
        <Link href="/pendulum" className={buttonClass.text}>Past answers</Link>
        <Link href="/pendulum/swings" className={buttonClass.text}>Your swings</Link>
      </div>

      <div className="border-t border-line-faint pt-4">
        {confirmDelete ? (
          <p className="text-xs text-ink-muted leading-relaxed">
            Delete this answer and what you wrote about it? Your swings are not touched. This cannot be undone.{" "}
            <button onClick={deleteAnswer} disabled={busy} className="text-danger-ink hover:text-danger-soft">
              {busy ? "Deleting…" : "Yes, delete"}
            </button>{" "}
            <button onClick={() => setConfirmDelete(false)} className="text-ink-faint hover:text-ink-soft">
              Cancel
            </button>
          </p>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={buttonClass.danger}>Delete this answer</button>
        )}
        {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
      </div>
    </Page>
  );
}
