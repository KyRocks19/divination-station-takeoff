"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { parseDate } from "@/lib/date";
import { FIT_LABELS, type Fit } from "@/lib/guess-core";
import { LOOK_BACK_CHOICES, lookBackDay, type LookBackChoice, type SameQuestionReading } from "@/lib/reading-extras-core";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/Page";

interface Extras {
  look_back_on: string | null;
  same: SameQuestionReading[];
}

const day = (iso: string) => parseDate(`${iso}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });

/**
 * Under every reading (rendered by GuessFirst): a reminder to look back on it in a week or a month, which then waits on today's page; and the
 * person's other readings that asked the same question, each with what they sensed first, side by side in their own words. Nothing is drawn until
 * it has loaded, and the "same question" part only when there is one and this reading's "write what you sense first" step is done.
 */
export default function ReadingExtras({ divinationId, held }: { divinationId: number | null | undefined; held: boolean }) {
  const uid = useId();
  const [data, setData] = useState<Extras | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!divinationId) return;
    let live = true;
    fetch(`/api/divinations/${divinationId}/extras`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setData(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [divinationId]);

  if (!divinationId || !data) return null;

  async function remind(choice: LookBackChoice | null) {
    setBusy(true);
    setNote("");
    const on = choice ? lookBackDay(new Date().toLocaleDateString("en-CA"), choice) : null;
    const res = await fetch(`/api/divinations/${divinationId}/extras`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ look_back_on: on }),
    }).catch(() => null);
    if (res?.ok) {
      setData((d) => (d ? { ...d, look_back_on: on } : d));
      setNote(on ? `Saved. It will wait for you on today's page from ${day(on)}.` : "Reminder removed.");
    } else {
      setNote((await res?.json().catch(() => null))?.error ?? "That could not be saved. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2" role="group" aria-labelledby={`${uid}-lb`}>
        <SectionLabel id={`${uid}-lb`}>Look back on this reading</SectionLabel>
        <p className="text-sm text-ink-muted">
          {data.look_back_on
            ? `You will be reminded on ${day(data.look_back_on)}, on today's page, to write what happened.`
            : "Ask to be reminded later to write what happened. How a reading looks afterwards is how a guess gets checked."}
        </p>
        <div className="flex flex-wrap gap-2">
          {LOOK_BACK_CHOICES.map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => remind(c.id)} className={buttonClass.quiet}>
              {c.label}
            </button>
          ))}
          {data.look_back_on && (
            <button type="button" disabled={busy} onClick={() => remind(null)} className={buttonClass.text}>
              No reminder
            </button>
          )}
        </div>
        <p role="status" className="text-xs text-ink-faint min-h-4">{note}</p>
      </Card>

      {/* Other readings' words wait until this reading's own first words are written, so they cannot lead them. */}
      {!held && data.same.length > 0 && (
        <Card className="space-y-2" role="group" aria-labelledby={`${uid}-sq`}>
          <SectionLabel id={`${uid}-sq`}>The same question, other readings</SectionLabel>
          <p className="text-sm text-ink-muted">
            You asked this question in {data.same.length === 1 ? "one other reading" : `${data.same.length} other readings`}. Here is what you sensed
            first in each, in your own words. Where they differ is yours to think about; the app does not compare them.
          </p>
          <ul className="space-y-2 list-none p-0">
            {data.same.slice(0, 6).map((r) => (
              <li key={r.id} className="border-l-2 border-line pl-3">
                <Link href={r.href} className="text-xs text-accent-ink hover:text-accent-ink-hover underline">
                  {r.tool}, {parseDate(r.when).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </Link>
                <p className="text-sm text-ink-soft whitespace-pre-wrap break-words">{r.guess ?? <span className="text-ink-ghost">Nothing written first.</span>}</p>
                {r.fit && <p className="text-xs text-ink-faint">You said it fitted: {FIT_LABELS[r.fit as Fit].toLowerCase()}</p>}
              </li>
            ))}
          </ul>
          <Link href="/questions" className="text-xs text-accent-ink hover:text-accent-ink-hover underline">Every question you asked more than once</Link>
        </Card>
      )}
    </div>
  );
}
