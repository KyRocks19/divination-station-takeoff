"use client";

import { useAiReady } from "@/components/AiReady";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { errorText } from "@/lib/ai-client";
import { SigilMark } from "@/components/ui/AppSigil";

interface QA {
  question: string;
  answer: string;
}

interface SavedInterview {
  id: number;
  content: string;
  created_at: string;
}

interface InterviewPanelProps {
  /** A tarot reading's own id (its page shows saved interviews among its journal entries). */
  readingId?: number;
  /** The shared record of a reading of any other kind (the `divinations` table): then saved interviews are listed here, and can be deleted here. */
  divinationId?: number;
  onSave?: () => void;
}

type Phase = "idle" | "loading-questions" | "answering" | "interpreting" | "done";

function InterviewPanelInner({ readingId, divinationId, onSave }: InterviewPanelProps) {
  // Which reading the request is about: a tarot reading's id, or a shared record's id.
  const subject = readingId !== undefined ? { reading_id: readingId } : { divination_id: divinationId };
  const [phase, setPhase] = useState<Phase>("idle");
  const started = useRef(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedInterview[]>([]);
  const uid = useId();
  const firstAnswer = useRef<HTMLTextAreaElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);

  // The button that was pressed goes away as the screen changes, which would drop keyboard and screen-reader focus to the
  // top of the page: move it to where the person goes next (the first question, the reading, or the start button).
  useEffect(() => {
    if (phase === "answering") firstAnswer.current?.focus();
    else if (phase === "done") result.current?.focus();
    else if (phase === "idle" && started.current) startButton.current?.focus();
  }, [phase]);

  const loadSaved = useCallback(async () => {
    if (divinationId === undefined) return;
    const res = await fetch(`/api/divinations/${divinationId}/interviews`).catch(() => null);
    if (res?.ok) setSaved(await res.json().catch(() => []));
  }, [divinationId]);
  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  async function removeSaved(entry: SavedInterview) {
    if (!window.confirm("Delete this interview? This cannot be undone.")) return;
    const res = await fetch(`/api/divinations/${divinationId}/journals/${entry.id}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 404)) await loadSaved();
    else setError("That could not be deleted. Try again.");
  }

  async function startInterview() {
    started.current = true;
    setPhase("loading-questions");
    setError("");
    setInterpretation("");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subject, phase: "questions" }),
      });
      if (!res.ok) throw new Error(await errorText(res, "Something went wrong. Try again."));
      const data = await res.json();
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => ""));
      setPhase("answering");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");
      setPhase("idle");
    }
  }

  async function generateInterpretation() {
    const qa: QA[] = questions.map((q, i) => ({ question: q, answer: answers[i] }));
    setPhase("interpreting");
    let accumulated = "";
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subject, phase: "interpret", qa }),
      });
      if (!res.ok || !res.body) throw new Error(await errorText(res, "Something went wrong. Try again."));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setInterpretation(accumulated);
      }
      setPhase("done");
      onSave?.();
      loadSaved();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");
      setPhase("answering");
    }
  }

  const canSubmit = phase === "answering" && answers.some((a) => a.trim());

  return (
    <section aria-label="Hiero Interview" className="bg-danger/10 border border-danger/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-danger-ink uppercase tracking-widest"><SigilMark /> Hiero — Interview</p>
        <span role="status" className="text-xs">
          {phase === "loading-questions" && <span className="text-danger-ink animate-pulse">Preparing questions…</span>}
          {phase === "interpreting" && <span className="text-danger-ink animate-pulse">Reading in context…</span>}
          {phase === "done" && <span className="text-success">Saved ✓</span>}
        </span>
      </div>

      {error && <p role="alert" className="text-xs text-danger-ink">{error}</p>}

      {phase === "idle" && (
        <button
          ref={startButton}
          onClick={startInterview}
          className="w-full text-xs bg-danger/10 hover:bg-danger/20 text-danger-ink hover:text-danger-soft font-medium py-2 px-3 rounded-lg transition-colors border border-danger/20"
        >
          <SigilMark /> Interview me about this reading
        </button>
      )}

      {(phase === "answering" || phase === "interpreting") && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="space-y-1.5">
              <label htmlFor={`${uid}-a${i}`} className="block text-sm text-danger-soft">{q}</label>
              <textarea
                id={`${uid}-a${i}`}
                ref={i === 0 ? firstAnswer : undefined}
                value={answers[i]}
                onChange={(e) => {
                  const updated = [...answers];
                  updated[i] = e.target.value;
                  setAnswers(updated);
                }}
                disabled={phase === "interpreting"}
                rows={3}
                className="w-full bg-canvas border border-danger/25 rounded-lg px-3 py-2 text-sm text-ink-strong placeholder-ink-ghost focus:border-danger resize-none disabled:opacity-60"
                placeholder="Your answer…"
              />
            </div>
          ))}
          <button
            onClick={generateInterpretation}
            disabled={phase === "interpreting" || !canSubmit}
            className="w-full text-xs bg-danger/10 hover:bg-danger/20 disabled:opacity-50 text-danger-ink hover:text-danger-soft font-medium py-2 px-3 rounded-lg transition-colors border border-danger/20"
          >
            {phase === "interpreting" ? "Reading…" : "Read in context"}
          </button>
        </div>
      )}

      {interpretation && (
        <div
          ref={result}
          tabIndex={-1}
          role="group"
          aria-label={phase === "done" ? "Your interview reading, saved" : "Your interview reading"}
          className="text-sm text-ink-strong leading-relaxed prose prose-invert prose-sm max-w-none border-t border-danger/10 pt-3"
        >
          <ReactMarkdown>{interpretation}</ReactMarkdown>
        </div>
      )}

      {saved.length > 0 && (
        <div className="space-y-2 border-t border-danger/10 pt-3">
          <h3 className="text-xs text-danger-ink">Earlier interviews</h3>
          <ul className="space-y-2">
            {saved.map((s) => (
              <li key={s.id} className="border border-danger/15 rounded-lg p-2">
                <details>
                  <summary className="cursor-pointer text-xs text-ink-soft">
                    {new Date(s.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </summary>
                  <div className="text-sm text-ink-strong leading-relaxed prose prose-invert prose-sm max-w-none mt-2">
                    <ReactMarkdown>{s.content}</ReactMarkdown>
                  </div>
                  <button
                    onClick={() => removeSaved(s)}
                    className="mt-2 text-xs text-danger-ink hover:text-danger-soft"
                    aria-label={`Delete the interview from ${new Date(s.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                  >
                    Delete
                  </button>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "done" && (
        <button
          onClick={startInterview}
          className="w-full text-xs bg-danger/5 hover:bg-danger/15 text-danger-ink hover:text-danger-soft font-medium py-1.5 px-3 rounded-lg transition-colors border border-danger/15"
        >
          Interview again
        </button>
      )}
    </section>
  );
}

/** Not in the Feathered edition, which has no AI (docs/plan-feathered-edition.md). */
export default function InterviewPanel(props: InterviewPanelProps) {
  // Left out when this copy cannot run it (no Claude key; always in Feathered): lib/ai-ready-core.ts.
  return useAiReady().claude ? <InterviewPanelInner {...props} /> : null;
}
