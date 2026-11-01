"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { BackLink, ErrorNote, Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import Nudges from "@/components/Nudges";
import LetterNotices from "@/components/LetterNotices";
import { parseDate } from "@/lib/date";
import { KIND_LABELS } from "@/lib/days-core";
import NewReadingMenu, { newReadingBigClass } from "@/components/NewReadingMenu";
import { useChosenTools } from "@/components/ChosenTools";
import type { DayView as DayData } from "@/lib/days";

const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/**
 * One day's page: your own writing, what you kept with the day, and the day's readings. Only you can see it. `embedded` draws it as the first section
 * of the Days page (today's page, there), with a heading of its own in place of the page's title and links. `letters` is false on a copy without
 * Letters (lib/edition-features.ts), so today's page does not ask for them and get "not found".
 */
export default function DayView({ day, embedded = false, letters = false }: { day: string; embedded?: boolean; letters?: boolean }) {
  const tools = useChosenTools();
  const bodyId = useId();
  const [data, setData] = useState<DayData | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether this is the person's today: their own calendar date, which only the browser knows, so it is read after the first draw.
  const [isToday, setIsToday] = useState(false);
  useEffect(() => setIsToday(day === new Date().toLocaleDateString("en-CA")), [day]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/days/${day}`).catch(() => null);
    if (!res?.ok) {
      setMessage((await res?.json().catch(() => null))?.error ?? "This day could not be loaded.");
      setState("failed");
      return;
    }
    setData(await res.json());
    setState("ready");
  }, [day]);

  useEffect(() => {
    setState("loading");
    setDraft(null);
    setSaved(false);
    void load();
  }, [load]);

  if (state === "loading") return <p role="status" className={embedded ? "text-sm text-ink-ghost" : "max-w-page mx-auto px-4 py-10 text-sm text-ink-ghost"}>Opening the day…</p>;
  if (state === "failed" || !data) {
    if (embedded) return <p className="text-sm text-ink-muted">{message}</p>;
    return (
      <Page>
        <BackLink href="/days">← All days</BackLink>
        <p className="text-sm text-ink-muted">{message}</p>
      </Page>
    );
  }

  const shown = draft ?? data.body;
  const changed = draft !== null && draft !== data.body;

  async function save() {
    if (!changed) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/days/${day}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error ?? "That could not be saved. Try again.");
    setSaved(true);
    setData({ ...data!, body: draft! });
    setDraft(null);
  }

  async function remove(id: number) {
    setError(null);
    const res = await fetch(`/api/days/${day}/items/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("That could not be taken off the day. Try again.");
    setData({ ...data!, items: data!.items.filter((i) => i.id !== id) });
  }

  const Wrap = embedded ? EmbeddedWrap : Page;
  return (
    <Wrap>
      {embedded ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="today-heading" className="text-lg font-semibold text-heading">
            Today&rsquo;s page <span className="text-sm font-normal text-ink-faint">· {longDate(day)}</span>
          </h2>
          <Link href={`/days/${day}`} className="inline-flex items-center min-h-11 sm:min-h-0 text-xs text-accent-ink underline">
            Open it on a page of its own
          </Link>
        </div>
      ) : (
        <>
          <div className="print:hidden flex flex-wrap items-center justify-between gap-2">
            <BackLink href="/days">← All days</BackLink>
            <span className="text-xs text-ink-ghost flex gap-3">
              {data.prev && <Link href={`/days/${data.prev}`} className="inline-flex items-center min-h-11 sm:min-h-0 hover:text-accent-ink">← Earlier day</Link>}
              <Link href="/days/today" className="inline-flex items-center min-h-11 sm:min-h-0 hover:text-accent-ink">Today</Link>
              {data.next && <Link href={`/days/${data.next}`} className="inline-flex items-center min-h-11 sm:min-h-0 hover:text-accent-ink">Later day →</Link>}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageTitle>{longDate(day)}</PageTitle>
            {isToday && (
              <div className="print:hidden">
                <NewReadingMenu tools={tools} className={newReadingBigClass} />
              </div>
            )}
          </div>
          <p className="text-xs text-ink-ghost flex flex-wrap items-center gap-3">
            <span>Only you can see this page.</span>
            <button onClick={() => window.print()} className="print:hidden text-accent-ink underline">Print this day, or save it as a PDF</button>
          </p>
        </>
      )}

      {isToday && <Nudges />}
      {isToday && letters && <LetterNotices />}

      {shown.trim() && <div aria-hidden="true" className="hidden print:block whitespace-pre-wrap text-sm">{shown}</div>}
      <section aria-label="Your writing for the day" className="print:hidden space-y-2">
        <label htmlFor={bodyId} className="block text-xs text-ink-faint uppercase tracking-widest">Your writing for the day</label>
        <Textarea
          id={bodyId}
          rows={8}
          maxLength={20000}
          value={shown}
          onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
          onBlur={() => void save()}
          placeholder="Whatever you want to remember about now. It is saved as you leave the box, or press Save."
        />
        <div className="flex items-center gap-3">
          <Button disabled={saving || !changed} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
          {saved && <span role="status" className="text-xs text-success">Saved</span>}
        </div>
      </section>
      {error && <ErrorNote>{error}</ErrorNote>}

      <section aria-labelledby="kept-heading" className="space-y-3">
        <SectionLabel id="kept-heading">Kept with this day</SectionLabel>
        {data.items.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet. On a reading, or under an answer you kept from the companion, press &ldquo;Add to a day&rdquo;.
          </p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {data.items.map((i) => (
              <li key={i.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-tone-900/40 text-tone-400 border border-line rounded px-1.5 py-0.5">{KIND_LABELS[i.kind]}</span>
                    <span className="text-ink-ghost">{i.mode === "snapshot" ? `Snapshot from ${parseDate(i.created_at).toLocaleDateString()}` : "Live link: shows the current version"}</span>
                  </div>
                  <h3 className="text-sm font-medium text-ink-strong">{i.title || "(no title)"}</h3>
                  {i.mode === "link" && i.originGone ? (
                    <p className="text-sm text-ink-muted">The original has been deleted, so there is nothing to show. You can take this off the day.</p>
                  ) : (
                    <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{i.text}</p>
                  )}
                  {i.mode === "snapshot" && i.originGone && <p className="text-xs text-ink-ghost">The original has been deleted. This copy is what it said.</p>}
                  <div className="flex items-center gap-4 text-xs">
                    {i.href && <Link href={i.href} className="text-tone-400 underline">Open where it came from</Link>}
                    <button onClick={() => remove(i.id)} aria-label={`Take “${i.title}” off this day`} className="print:hidden text-ink-ghost hover:text-danger-ink">Take off this day</button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.readings === null ? (
        <p className="text-xs text-ink-ghost">
          Listing the day&rsquo;s readings is switched off. You can turn it on in <Link href="/settings" className="underline">Settings</Link>.
        </p>
      ) : (
        <section aria-labelledby="readings-heading" className="space-y-2">
          <SectionLabel id="readings-heading">Readings you made this day{data.readings.length > 0 ? ` (${data.readings.length})` : ""}</SectionLabel>
          {data.readings.length === 0 ? (
            <p className="text-sm text-ink-muted">None.</p>
          ) : (
            // In the order they were made, with the time each was made at (in this browser's time zone).
            <ol className="list-none p-0 border-l border-line ml-1.5 space-y-3">
              {data.readings.map((r) => (
                <li key={r.id} className="relative pl-4">
                  <span aria-hidden="true" className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-tone-500" />
                  <p className="text-xs text-ink-ghost">
                    <time dateTime={r.at}>{parseDate(r.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time> · {r.label}
                  </p>
                  <Link href={r.href} className="inline-block min-h-6 py-0.5 max-sm:min-h-11 max-sm:py-2.5 text-sm text-ink-soft hover:text-ink-strong underline">
                    {r.summary || "Open the reading"}
                  </Link>
                  {r.question && <p className="text-xs text-ink-faint">Your question: &ldquo;{r.question}&rdquo;</p>}
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-ink-ghost">These are links only; nothing here is copied. Press &ldquo;Add to a day&rdquo; on a reading to keep a copy.</p>
        </section>
      )}

      {isToday && !embedded && (
        <p className="print:hidden text-xs text-ink-ghost">
          A reading you make today is listed here once it is saved. <Link href="/days" className="underline">All your days, and the calendar</Link>
        </p>
      )}
    </Wrap>
  );
}

/** The frame for today's page on the Days page: a soft panel, named by its heading. */
function EmbeddedWrap({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="today-heading" className="rounded-card border border-line-accent bg-surface/60 p-4 sm:p-5 space-y-5">
      {children}
    </section>
  );
}
