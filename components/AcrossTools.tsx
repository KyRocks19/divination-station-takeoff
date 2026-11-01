"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseDate } from "@/lib/date";
import { DIVINATION_KIND_LABELS, type DivinationKind } from "@/lib/divination-kinds";
import type { Recurring, Shift, Tally, MonthThemes, WhenCounts } from "@/lib/patterns-core";
import type { OwnMonthThemes } from "@/lib/own-tallies-core";
import { NOTE_WORD_MIN_NOTES, type NoteWord } from "@/lib/note-words-core";
import { usePrefs } from "@/components/usePrefs";
import { useCompanionJobs } from "@/components/useCompanionJobs";
import PatternQuestion from "@/components/PatternQuestion";
import { patternRef } from "@/lib/companion-pattern-ref";
import { styleRef } from "@/lib/apply-style";
import { buttonClass } from "@/components/ui/Button";
import { CONFIDENCE_LABELS, FITS, FIT_LABELS, MIN_FITS_FOR_AVERAGE, type ConfidenceRow, type FitMonth, type TagFit } from "@/lib/guess-core";

interface PatternsData {
  when: WhenCounts;
  themes: MonthThemes[];
  ownThemes?: OwnMonthThemes[];
  recurring: Recurring[];
  shifts: Shift[];
  fits?: FitMonth[];
  confidence?: ConfidenceRow[];
  tagFits?: TagFit[];
  overallFit?: number | null;
  noteWords?: NoteWord[];
}

const day = (s: string) => parseDate(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-xs text-ink-faint uppercase tracking-widest">{title}</h2>
      <p className="text-xs text-ink-ghost">{note}</p>
      {children}
    </section>
  );
}

function Bars({ title, rows }: { title: string; rows: Tally[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs text-ink-muted">{title}</h3>
      <ul className="space-y-1 list-none p-0">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-xs">
            <span className="w-52 shrink-0 text-ink-soft">{r.label}</span>
            <span className="flex-1 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-tone-500 w-0" ref={styleRef({ width: `${(r.count / max) * 100}%` })} />
            </span>
            <span className="w-8 text-right text-tone-500">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The "across all your tools" block at the top of Patterns: when you read, themes over time, symbols that keep coming up, and how your own wording
 * has shifted. Counts and dates only, in this order. It says what is there and never what it means. Only ever the signed-in person's own.
 */
export default function AcrossTools({ shown }: { shown: DivinationKind[] | null }) {
  const [data, setData] = useState<PatternsData | null>(null);
  const [failed, setFailed] = useState(false);
  // Example data (release plan idea 7): made by the app each time, never stored, and labelled on the page while it is shown.
  const [example, setExample] = useState(false);
  // The person's own year, known only to the browser, so it is read after the first draw.
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  const key = shown ? shown.join(",") : "";
  // One shared connection to the companion for every pattern on the page (the buttons only show when the companion is switched on).
  const prefs = usePrefs();
  const pq = useCompanionJobs({ patterns: true }, prefs.companionEnabled);

  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    fetch(example ? "/api/patterns?example=1" : `/api/patterns${key ? `?tools=${encodeURIComponent(key)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [key, example]);

  if (failed) return <p className="text-sm text-ink-faint">The patterns across your tools could not be loaded. Try refreshing.</p>;
  if (!data) return <p role="status" className="text-sm text-ink-ghost">Counting…</p>;
  const { when, themes, recurring, shifts } = data;
  const ownThemes = data.ownThemes ?? [];
  const fits = data.fits ?? [];
  const confidence = data.confidence ?? [];
  const tagFits = data.tagFits ?? [];
  const overall = data.overallFit ?? null;
  const noteWords = example ? [] : data.noteWords ?? [];
  const exampleButton = (
    <button type="button" onClick={() => setExample((e) => !e)} className={`${buttonClass.quiet} min-h-6`}>
      {example ? "Show my own patterns" : "Show an example with made-up data"}
    </button>
  );
  if (when.total === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-muted">Your patterns appear here as you make readings. To see what about thirty days of use looks like, you can look at an example first.</p>
        {exampleButton}
      </div>
    );
  }
  const ask = prefs.companionEnabled && !example;

  return (
    <div className="space-y-8">
      {example && (
        <div role="status" className="border-2 border-dashed border-line-strong rounded-card p-4 space-y-2">
          <p className="text-sm text-ink-strong font-semibold">This is an example with made-up data. None of it is yours.</p>
          <p className="text-xs text-ink-muted">It is made by the app each time you look and is not saved anywhere, so there is nothing to delete.</p>
          {exampleButton}
        </div>
      )}
      {!example && <div>{exampleButton}</div>}
      <div>
        <h2 className="text-sm text-ink-soft font-semibold">Across your tools</h2>
        <p className="text-xs text-ink-ghost mt-1">
          Counted and dated from your own readings and your own words, with every tool together. It says what is there and never what it means.
          Only you can see it.
        </p>
      </div>

      <Section title="When you read" note="How many readings fell in each time. Nothing here says one time is better than another.">
        <div className="bg-surface border border-line rounded-card p-4 space-y-4">
          <Bars title="Time of day" rows={when.partOfDay} />
          <Bars title="Day of the week" rows={when.weekday} />
          <Bars title="Moon phase" rows={when.moonPhase} />
          <Bars title="Since which festival" rows={when.festival} />
          {(when.noSky > 0 || when.noTimeZone > 0) && (
            <p className="text-xs text-ink-ghost">
              {when.noSky > 0 && `${when.noSky} of ${when.total} readings have no sky saved and are left out of these counts. `}
              {when.noTimeZone > 0 && `${when.noTimeZone} have no time zone saved and are left out of the time of day.`}
            </p>
          )}
        </div>
      </Section>

      <Section title="Themes over time" note="The shared themes that cards and symbols touched, month by month. A count is how many times a card or symbol touching the theme came up.">
        {themes.length === 0 ? (
          <p className="text-sm text-ink-muted">No themes to count yet.</p>
        ) : (
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {themes.map((m) => (
              <li key={m.month} className="px-4 py-3 space-y-1.5">
                <h3 className="text-xs text-ink-muted">{monthName(m.month)}</h3>
                <p className="text-sm text-ink-soft flex flex-wrap gap-x-4 gap-y-1">
                  {m.themes.map((t) => (
                    <span key={t.slug}>
                      <Link href={`/archetypes/${t.slug}`} className="underline hover:text-ink-strong">{t.name}</Link>
                      <span className="text-xs text-tone-500"> ×{t.count}</span>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {ownThemes.length > 0 && (
        <Section
          title="Your own themes over time"
          note="The archetypes and concepts you made yourself, month by month. A count is how many times a card or symbol you linked to one came up. These are counted apart from the shared themes above and never added to them."
        >
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {ownThemes.map((m) => (
              <li key={m.month} className="px-4 py-3 space-y-1.5">
                <h3 className="text-xs text-ink-muted">{monthName(m.month)}</h3>
                <p className="text-sm text-ink-soft flex flex-wrap gap-x-4 gap-y-1">
                  {m.themes.map((t) => (
                    <span key={t.key}>
                      {t.name}
                      <span className="text-xs text-ink-faint"> ({t.kind === "your archetype" ? "yours" : "your concept"})</span>
                      <span className="text-xs text-tone-500"> ×{t.count}</span>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Symbols that keep coming up" note="Anything that came up in two or more different readings, with the dates. Each date opens that reading.">
        {recurring.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing has come up twice yet.</p>
        ) : (
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {recurring.map((r) => (
              <li key={`${r.kind}-${r.key}`} className="px-4 py-3 space-y-1">
                <p className="text-sm text-ink-soft">
                  <span className="font-medium text-ink-strong">{r.name}</span>
                  <span className="text-xs text-ink-ghost"> · {DIVINATION_KIND_LABELS[r.kind]} · {r.count} times</span>
                </p>
                <p className="text-xs text-ink-faint flex flex-wrap gap-x-3 gap-y-1">
                  {r.earlier > 0 && <span>{r.earlier} earlier</span>}
                  {r.entries.map((e, i) => (
                    <Link key={`${e.href}-${i}`} href={e.href} className="underline hover:text-ink-soft">{day(e.when)}</Link>
                  ))}
                </p>
                {ask && <PatternQuestion pattern={patternRef(r.kind, r.key)} name={r.name} jobs={pq} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {noteWords.length > 0 && (
        <Section
          title="Words that keep coming back in your signs and dreams"
          note={`Words you used in ${NOTE_WORD_MIN_NOTES} or more of your notes, with the dates. Very common words are left out. Each date opens that note.`}
        >
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {noteWords.map((w) => (
              <li key={w.word} className="px-4 py-3 space-y-1">
                <p className="text-sm text-ink-soft">
                  <span className="font-medium text-ink-strong break-words">{w.word}</span>
                  <span className="text-xs text-ink-ghost"> · in {w.count} notes</span>
                </p>
                <p className="text-xs text-ink-faint flex flex-wrap gap-x-3 gap-y-1">
                  {w.earlier > 0 && <span>{w.earlier} earlier</span>}
                  {w.entries.map((e) => (
                    <Link key={e.id} href={`/signs/${e.id}`} className="underline hover:text-ink-soft">{day(e.when)}</Link>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="How your own wording has shifted" note="Things you have worded more than once, your wordings in the order you wrote them, exactly as you wrote them. It does not say whether a change is growth or noise. That is yours to decide.">
        {shifts.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing you have worded has changed yet.</p>
        ) : (
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {shifts.map((s) => (
              <li key={`${s.kind}-${s.key}`} className="px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-ink-strong">
                  {s.name}
                  {s.kind && <span className="text-xs text-ink-ghost font-normal"> · {DIVINATION_KIND_LABELS[s.kind]}</span>}
                </p>
                <ol className="space-y-1.5 list-none p-0">
                  {s.versions.map((v, i) => (
                    <li key={i} className="text-sm text-ink-soft">
                      <span className="text-xs text-tone-500">{day(v.when)}</span>
                      <span className="block whitespace-pre-wrap">{v.text}</span>
                    </li>
                  ))}
                </ol>
                {ask && s.kind && <PatternQuestion pattern={patternRef(s.kind, s.key)} name={s.name} jobs={pq} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {fits.length > 0 && (
        <Section
          title="How well what you sensed first fitted"
          note={`Month by month, how well you said the words you wrote before opening a reading fitted it afterwards. Only you say how well. An average appears for a month with ${MIN_FITS_FOR_AVERAGE} or more answers. It is a mirror of your practice, not a score.`}
        >
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {fits.map((m) => (
              <li key={m.month} className="px-4 py-3 space-y-1.5">
                <h3 className="text-xs text-ink-muted">
                  {monthName(m.month)}
                  <span className="text-ink-ghost"> · {m.rated} answered{m.average !== null ? `, on average ${m.average} out of 5` : ""}</span>
                </h3>
                <ul className="space-y-1 list-none p-0">
                  {[...FITS].reverse().filter((f) => m.counts[f] > 0).map((f) => (
                    <li key={f} className="flex items-center gap-3 text-xs">
                      <span className="w-28 shrink-0 text-ink-soft">{FIT_LABELS[f]}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
                        <span className="block h-full bg-tone-500 w-0" ref={styleRef({ width: `${(m.counts[f] / m.rated) * 100}%` })} />
                      </span>
                      <span className="w-8 text-right text-tone-500">{m.counts[f]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-ghost">
            Every guess, by tool, is on <Link href="/predictions" className="underline">Predictions</Link>.
          </p>
        </Section>
      )}

      {confidence.length > 0 && (
        <Section
          title="Feeling sure, and fitting"
          note="How sure you said you felt when you sealed your words, beside how often you later said they fitted mostly or very well. Feeling sure and being right are different things; this shows how they go together for you. A few answers are too few to read much into, so the number behind each line is shown."
        >
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {confidence.map((c) => (
              <li key={c.confidence} className="px-4 py-3 text-sm text-ink-soft">
                <span className="font-medium text-ink-strong">{CONFIDENCE_LABELS[c.confidence]}:</span> fitted mostly or very well {c.fittedWell} of {c.rated} time{c.rated === 1 ? "" : "s"}
                {c.rated < MIN_FITS_FOR_AVERAGE && <span className="text-xs text-ink-ghost"> (too few to say much)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tagFits.length > 0 && (
        <Section
          title="Conditions and fitting"
          note={`How well your first words fitted on readings with each of your tags (for example a tag like “rested” or “rushed”). An average shows once a tag has ${MIN_FITS_FOR_AVERAGE} answers. There is no chance figure for how well words fit, so each is set beside your own average${overall !== null ? `, ${overall} out of 5` : ""}.`}
        >
          <ul className="bg-surface border border-line rounded-card divide-y divide-tone-900/20 list-none p-0">
            {tagFits.map((t) => (
              <li key={t.tag} className="px-4 py-3 text-sm text-ink-soft">
                <span className="font-medium text-ink-strong break-words">{t.tag}:</span> {t.rated} answered
                {t.average !== null ? `, on average ${t.average} out of 5` : <span className="text-xs text-ink-ghost"> (too few for an average)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!example && year !== null && (
        <Section
          title="Your year as a file"
          note="One year of your own readings and words, written as your own timeline in a Markdown file you keep on your device. It says what is there, not what it means."
        >
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[year, year - 1].map((y) => (
              <a key={y} href={`/api/year-review?year=${y}`} download className="text-accent-ink hover:text-accent-ink-hover underline inline-flex items-center min-h-6">
                Download {y}
              </a>
            ))}
          </p>
        </Section>
      )}

      {!prefs.companionEnabled && !example && (
        <p className="text-xs text-ink-ghost">
          You can turn on an AI companion in <Link href="/settings" className="underline">Settings</Link> to be asked a question about any pattern above. It is off until you do.
        </p>
      )}
    </div>
  );
}
