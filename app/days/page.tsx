import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listDays, type DayListing } from "@/lib/days";
import { getWheel, monthDays } from "@/lib/calendar";
import { festivalsFor, isValidMonth, moonOn, nextFestival } from "@/lib/calendar-core";
import { CardLink } from "@/components/ui/Card";
import WitchCalendar from "@/components/days/WitchCalendar";
import NewReadingMenu, { newReadingBigClass } from "@/components/NewReadingMenu";
import TodayOnHub from "@/components/days/TodayOnHub";
import { hiddenIn } from "@/lib/edition-features";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";

export const metadata = { title: "Days" };

/** How many months of days the Days page lists, newest first. */
const MONTHS_LISTED = 3;

const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "3 readings: Tarot, Runes" */
const readingLine = (d: DayListing) => `${d.readings} ${d.readings === 1 ? "reading" : "readings"}: ${d.tools.join(", ")}`;

// The hub of the app (owner's requests, 2026-10-29 and 10-30): one big "+ New Reading", today's page, the calendar, then the person's days, newest
// first, grouped by month. Every other place is in the side navigation, so it is not repeated here. Every day they made a reading on is listed
// (unless they turned listing readings off), as well as the days they wrote on or kept something with.
export default async function DaysPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const prefs = await getPrefs(session.userId);
  // The calendar's month (?m=YYYY-MM); without one, this month in UTC, off by one only in the hours either side of the turn of a month.
  const { m } = await searchParams;
  const month = isValidMonth(m) ? m : new Date().toISOString().slice(0, 7);
  const [days, wheel, monthList] = await Promise.all([
    listDays(session.userId, 400, prefs.daysListReadings),
    getWheel(session.userId),
    monthDays(session.userId, month, prefs.daysListReadings),
  ]);

  // Above the calendar: the moon and the next festival, from today in UTC (a day off at most, which a card can bear).
  const todayUtc = new Date().toISOString().slice(0, 10);
  const moon = moonOn(todayUtc);
  const coming = nextFestival(festivalsFor(wheel, prefs.hemisphere), todayUtc);

  // Only the newest months are listed here; the calendar has every month.
  const byMonth = new Map<string, DayListing[]>();
  for (const d of days) byMonth.set(d.day.slice(0, 7), [...(byMonth.get(d.day.slice(0, 7)) ?? []), d]);
  const months = [...byMonth.entries()];
  const shown = months.slice(0, MONTHS_LISTED);
  const older = months.slice(MONTHS_LISTED).reduce((n, [, list]) => n + list.length, 0);

  return (
    <Page>
      <BackLink href="/">← Your tools</BackLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Days</PageTitle>
        <NewReadingMenu tools={prefs.tools} className={newReadingBigClass} />
      </div>
      <p className="text-sm text-ink-faint">
        A page for each day: the readings you made, your own writing, and anything you kept with that time. Only you can see it.
      </p>

      <TodayOnHub letters={!hiddenIn(process.env.DS_EDITION, "/letters")} />

      <section aria-labelledby="calendar-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="calendar-heading" className="text-lg font-semibold text-heading">
            <span aria-hidden="true" className="mr-2">{moon.symbol}</span>Calendar
          </h2>
          <p className="text-xs text-ink-faint">
            {moon.phase}
            {coming && (
              <>
                {" · "}
                <span className="text-blush">✶ {coming.festival.name}</span>{" "}
                {coming.inDays === 0 ? "today" : coming.inDays === 1 ? "tomorrow" : `in ${coming.inDays} days`}
              </>
            )}
          </p>
        </div>
        <p className="text-sm text-ink-faint">
          Your days by the month, with the moon and the festivals you keep. Point at a day (or tap it on a phone) to see what you read and wrote then, and
          press it to open the day.
        </p>
        <WitchCalendar month={month} days={monthList} wheel={wheel} hemisphere={prefs.hemisphere} />
      </section>

      <SectionLabel id="history-heading">Your days</SectionLabel>
      {!prefs.daysListReadings && (
        <p className="text-xs text-ink-ghost">
          Listing readings on their days is switched off, so only days you wrote on or kept something with are here. You can turn it on in{" "}
          <Link href="/settings" className="underline">Settings</Link>.
        </p>
      )}
      {days.length === 0 ? (
        <p className="text-sm text-ink-muted">No days yet. Make a reading, or write something on today&rsquo;s page above.</p>
      ) : (
        shown.map(([month, list]) => (
          <section key={month} aria-labelledby={`m-${month}`} className="space-y-2">
            <h3 id={`m-${month}`} className="text-xs text-ink-faint uppercase tracking-widest">{monthName(month)}</h3>
            <ul className="space-y-2 list-none p-0">
              {list.map((d) => (
                <li key={d.day}>
                  <CardLink href={`/days/${d.day}`} lift>
                    <p className="text-sm font-medium text-ink-strong">{dayName(d.day)}</p>
                    {d.readings > 0 && <p className="text-xs text-tone-400 mt-0.5">{readingLine(d)}</p>}
                    {d.snippet && <p className="text-sm text-ink-faint line-clamp-2 whitespace-pre-wrap">{d.snippet}</p>}
                    {d.items > 0 && <p className="text-xs text-ink-ghost mt-1">{d.items} kept with this day</p>}
                  </CardLink>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {older > 0 && (
        <p className="text-sm text-ink-faint">
          {older} older {older === 1 ? "day is" : "days are"} on the <Link href={`/days?m=${months[MONTHS_LISTED][0]}#calendar`} className="underline text-accent-ink">calendar</Link>, a month at a time.
        </p>
      )}
      <p className="text-xs text-ink-ghost">
        To keep your days as plain text files in a folder on this computer, go to <Link href="/settings#days-folder" className="underline">Settings, Your records</Link>.
      </p>
    </Page>
  );
}
