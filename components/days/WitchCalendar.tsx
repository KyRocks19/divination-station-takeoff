"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  daySummaryText, festivalsFor, festivalsInMonth, monthGrid, moonOn, shiftMonth, type CalendarDay, type Festival, type WheelChoices,
} from "@/lib/calendar-core";
import { isValidDay } from "@/lib/days-core";
import type { Hemisphere } from "@/lib/sky";
import WheelEditor from "@/components/days/WheelEditor";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthTitle = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const monthOnly = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** A little bat, drawn in the colour of the text around it. */
function Bat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" className={className}>
      <path
        className="fill-current"
        d="M12 4.2 10.9 2l-.3 2.6C9 5.5 7.6 5.2 6.4 4 5.8 6 4 7.2 1 7c1.7 1 2.6 2.6 2.6 4.4 1.3-.9 2.9-.9 4 .2.6-1.2 1.8-1.7 3-1.2L12 13l1.4-2.6c1.2-.5 2.4 0 3 1.2 1.1-1.1 2.7-1.1 4-.2 0-1.8.9-3.4 2.6-4.4-3 .2-4.8-1-5.4-3-1.2 1.2-2.6 1.5-4.2.6L13.1 2z"
      />
    </svg>
  );
}

/** Up to five small stars, one for each reading of the day. */
function Stars({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span aria-hidden="true" className="text-[10px] leading-none text-tone-400 tracking-tighter">
      {"✦".repeat(Math.min(n, 5))}
      {n > 5 && <span className="text-ink-ghost"> +{n - 5}</span>}
    </span>
  );
}

type SummaryProps = { day: string; d?: CalendarDay; festivals: Festival[]; moon: { phase: string; symbol: string } };

/**
 * What shows beside a day while the pointer is over it (or it has the keyboard's focus). Screen readers hear the same in the day's link. Not on a
 * touch screen, which has no pointing: there the first tap on a day shows the same words under the calendar (DayPicked).
 */
function DayPopover({ col, up, ...rest }: SummaryProps & { col: number; up: boolean }) {
  const side = col <= 1 ? "left-0" : col >= 5 ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none hidden group-hover:block group-focus-within:block absolute z-30 ${up ? "bottom-full mb-2" : "top-full mt-2"} w-64 max-w-[80vw] ${side} rounded-card border border-line-accent bg-surface p-3 shadow-xl space-y-1.5 text-left motion-safe:animate-[overlay-fade-in_120ms_ease-out]`}
    >
      <DaySummary {...rest} />
    </div>
  );
}

/** The day picked with a tap on a touch screen: its summary, and the way into the day. */
function DayPicked({ onClose, ...rest }: SummaryProps & { onClose: () => void }) {
  return (
    <div className="relative mt-2 rounded-card border border-line-accent bg-surface p-3 space-y-2">
      <DaySummary {...rest} />
      <div className="flex flex-wrap items-center gap-4">
        {isValidDay(rest.day) && (
          <Link href={`/days/${rest.day}`} className="inline-flex items-center min-h-11 text-sm text-accent-ink underline">Open this day</Link>
        )}
        <button type="button" onClick={onClose} className="inline-flex items-center min-h-11 text-sm text-ink-faint hover:text-ink-soft">Close</button>
      </div>
    </div>
  );
}

function DaySummary({ day, d, festivals, moon }: SummaryProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-strong">{longDate(day)}</p>
      <p className="text-xs text-ink-faint">
        <span className="mr-1">{moon.symbol}</span>
        {moon.phase}
      </p>
      {festivals.map((f) => (
        <p key={f.id} className="text-xs text-blush">✶ {f.name}</p>
      ))}
      {d && d.readings > 0 && (
        <p className="text-xs text-tone-400">
          {d.readings} {d.readings === 1 ? "reading" : "readings"}: {d.tools.join(", ")}
        </p>
      )}
      {d?.top && (
        <div className="rounded-control bg-surface-sunken border border-line px-2 py-1.5">
          <p className="text-[11px] uppercase tracking-widest text-ink-ghost">
            {d.top.views > 1 ? `Opened most (${d.top.views} times)` : d.readings > 1 ? "First reading" : "The reading"}
          </p>
          <p className="text-xs text-ink-soft">
            {d.top.label}
            {d.top.summary && <span className="text-ink-faint">: {d.top.summary}</span>}
          </p>
        </div>
      )}
      {d?.snippet && <p className="text-xs text-ink-muted italic line-clamp-2">&ldquo;{d.snippet}&rdquo;</p>}
      {d && d.items > 0 && <p className="text-[11px] text-ink-ghost">{d.items} kept with this day</p>}
      {!d && festivals.length === 0 && <p className="text-[11px] text-ink-ghost">Nothing written or read yet.</p>}
    </div>
  );
}

/** True on a screen with no hovering (a phone or tablet), where a first tap shows a day's summary before a second one opens it. */
const touchOnly = () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

interface Props {
  month: string;
  days: CalendarDay[];
  wheel: WheelChoices;
  hemisphere: Hemisphere;
}

/**
 * The calendar of the person's days (owner's request, 2026-10-30): a month of little cells, each with its moon, any festival they keep and a star for
 * each reading. Hovering over a day, or tabbing to it, shows what happened then, with the reading they opened most. Pressing a day opens its page; on a
 * touch screen the first tap shows the summary under the calendar and a second tap on the same day opens it.
 */
export default function WitchCalendar({ month, days, wheel, hemisphere }: Props) {
  const [choices, setChoices] = useState(wheel);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [month]);
  // Whether this screen can point and hover; a touch screen gets the summary under the calendar instead of beside the day.
  const [canHover, setCanHover] = useState(false);
  useEffect(() => setCanHover(!touchOnly()), []);
  // Today is the person's own calendar date, which only the browser knows, so it is marked after the first draw.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toLocaleDateString("en-CA")), []);

  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const festivals = useMemo(() => festivalsFor(choices, hemisphere), [choices, hemisphere]);
  const inMonth = useMemo(() => festivalsInMonth(month, festivals), [month, festivals]);
  const cells = monthGrid(month);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const upcoming = [...inMonth.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div id="calendar" className="space-y-6 scroll-mt-(--header-h)">
      {/* Not overflow-hidden: the summary beside a day may reach past the panel's edge. */}
      <Card pad="md" className="relative bg-linear-to-b from-tone-900/50 to-surface border-line-accent">
        <div className="relative flex flex-wrap items-center justify-between gap-2 pb-4">
          <Link href={`/days?m=${prev}#calendar`} scroll={false} className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 px-2 rounded-control text-sm text-ink-faint hover:text-accent-ink">
            ← <span className="sr-only sm:not-sr-only">{monthOnly(prev)}</span>
          </Link>
          <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-heading tracking-wide text-center">
            {/* A bat either side and a few stars, for the look only. */}
            <span aria-hidden="true" className="hidden sm:flex items-end gap-0.5 text-tone-500">
              <span className="text-[10px] text-blush opacity-70 self-start">✦</span>
              <Bat className="h-4 w-6 opacity-80 motion-safe:animate-[cal-float_6s_ease-in-out_infinite]" />
            </span>
            <span aria-hidden="true">🌙</span>
            {monthTitle(month)}
            <span aria-hidden="true" className="hidden sm:flex items-start gap-0.5 text-tone-500">
              <Bat className="h-3 w-5 opacity-70 -scale-x-100 motion-safe:animate-[cal-float_8s_ease-in-out_infinite]" />
              <span className="text-xs text-tone-400 opacity-70">✧</span>
            </span>
          </h3>
          <Link href={`/days?m=${next}#calendar`} scroll={false} className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 px-2 rounded-control text-sm text-ink-faint hover:text-accent-ink">
            <span className="sr-only sm:not-sr-only">{monthOnly(next)}</span> →
          </Link>
        </div>

        <table className="relative w-full table-fixed border-separate border-spacing-1 sm:border-spacing-1.5">
          <caption className="sr-only">{monthTitle(month)}. Each day opens its page.</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="text-center text-[11px] font-normal uppercase tracking-widest text-ink-ghost">
                  <abbr title={w} className="no-underline">{w.slice(0, 1)}<span className="hidden sm:inline">{w.slice(1)}</span></abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <tr key={row}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <td key={`b${col}`} />;
                  const d = byDay.get(day);
                  const fest = inMonth.get(day) ?? [];
                  const moon = moonOn(day);
                  const isToday = day === today;
                  const full = moon.phase === "Full Moon";
                  const cellClass = `flex flex-col items-stretch gap-0.5 h-16 sm:h-24 w-full rounded-card border p-1 sm:p-1.5 text-left transition-all motion-safe:duration-150 ${
                    isToday ? "border-blush ring-2 ring-blush/50" : fest.length ? "border-line-accent" : "border-line"
                  } ${d ? "bg-surface" : "bg-surface/50"}`;
                  const inside = (
                    <>
                      <span className="flex items-start justify-between">
                        <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-blush" : "text-ink-soft"}`}>{Number(day.slice(8))}</span>
                        <span aria-hidden="true" className={`text-[11px] sm:text-sm leading-none ${full ? "" : "opacity-70"}`}>{moon.symbol}</span>
                      </span>
                      {fest.length > 0 && (
                        <span aria-hidden="true" className="hidden sm:block truncate text-[10px] text-blush">✶ {fest[0].name}{fest.length > 1 ? ` +${fest.length - 1}` : ""}</span>
                      )}
                      {fest.length > 0 && <span aria-hidden="true" className="sm:hidden text-[10px] leading-none text-blush">✶</span>}
                      <span className="mt-auto flex items-center justify-between gap-1">
                        <Stars n={d?.readings ?? 0} />
                        {d?.snippet && <span aria-hidden="true" className="text-[10px] text-ink-ghost">✎</span>}
                      </span>
                      <span className="sr-only">. {daySummaryText(d, fest, moon.phase)}</span>
                    </>
                  );
                  return (
                    <td key={day} className="relative group p-0 align-top">
                      {isValidDay(day) ? (
                        <Link
                          href={`/days/${day}`}
                          aria-current={isToday ? "date" : undefined}
                          onClick={(e) => {
                            if (picked === day || !touchOnly()) return;
                            e.preventDefault();
                            setPicked(day);
                          }}
                          className={`${cellClass} hover:border-tone-400 hover:bg-surface-sunken motion-safe:hover:-translate-y-0.5 hover:shadow-lg focus-visible:border-focus`}
                        >
                          <span className="sr-only">{longDate(day)}</span>
                          {inside}
                        </Link>
                      ) : (
                        // A day still to come has no page yet: pressing it shows its summary under the calendar.
                        <button type="button" onClick={() => setPicked(day)} className={`${cellClass} opacity-80 hover:border-tone-400 focus-visible:border-focus`}>
                          <span className="sr-only">{longDate(day)}, still to come</span>
                          {inside}
                        </button>
                      )}
                      {canHover && <DayPopover day={day} d={d} festivals={fest} moon={moon} col={col} up={row >= cells.length / 7 - 2} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* The day picked with a tap (or a day still to come, pressed): announced when it changes. */}
        <div aria-live="polite">
          {picked && (
            <DayPicked day={picked} d={byDay.get(picked)} festivals={inMonth.get(picked) ?? []} moon={moonOn(picked)} onClose={() => setPicked(null)} />
          )}
        </div>

        <p className="relative pt-2 text-[11px] text-ink-ghost flex flex-wrap gap-x-4 gap-y-1">
          <span>🌕 the moon that day</span>
          <span><span className="text-blush">✶</span> a festival</span>
          <span><span className="text-tone-400">✦</span> a reading</span>
          <span>✎ you wrote</span>
          <Link href="/days#calendar" scroll={false} className="underline hover:text-accent-ink">This month</Link>
        </p>
      </Card>

      {upcoming.length > 0 && (
        <section aria-labelledby="cal-festivals" className="space-y-2">
          <h3 id="cal-festivals" className="text-xs text-ink-faint uppercase tracking-widest">Festivals this month</h3>
          <ul className="list-none p-0 space-y-1">
            {upcoming.map(([day, list]) => (
              <li key={day} className="text-sm text-ink-soft">
                <span className="text-blush mr-2" aria-hidden="true">✶</span>
                {list.map((f) => f.name).join(", ")} <span className="text-ink-ghost">· {longDate(day)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WheelEditor choices={choices} hemisphere={hemisphere} onSaved={setChoices} />
    </div>
  );
}
