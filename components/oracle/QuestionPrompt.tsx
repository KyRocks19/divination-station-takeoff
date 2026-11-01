"use client";

import { useState } from "react";
import Link from "next/link";
import { FINDING_QUESTIONS, WRITING_QUESTIONS } from "@/lib/oracle-prompts";

interface Props {
  /** "finding" helps a person think of a card to make; "writing" helps them write on a card. */
  set: "finding" | "writing";
}

/**
 * One fixed question at a time, for a person who is unsure. It never fills anything in.
 * The page shows it only when the person's "questions in the oracle deck" setting is on.
 */
export default function QuestionPrompt({ set }: Props) {
  const questions = set === "finding" ? FINDING_QUESTIONS : WRITING_QUESTIONS;
  const [index, setIndex] = useState(0);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-ink-faint uppercase tracking-widest">A question, if you want one</p>
      <p className="text-sm text-tone-200" aria-live="polite">{questions[index]}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % questions.length)}
          className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-accent-ink hover:text-accent-ink-hover transition-colors"
        >
          Another question
        </button>
        <Link href="/settings" className="max-sm:inline-flex max-sm:items-center max-sm:min-h-11 text-xs text-ink-ghost hover:text-ink-muted transition-colors">
          Turn off in Settings
        </Link>
      </div>
    </div>
  );
}
