import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { parseDate, toISOString } from "@/lib/date";
import SourcesLine from "@/components/sources/SourcesLine";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

interface TarotRow {
  id: number;
  title: string | null;
  spread_name: string;
  question: string | null;
  created_at: string;
}

const SHOWN = 20;

/** Tarot's own page, laid out like the page of every other tool: start a reading, read the tradition, see past readings. */
export default async function TarotPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const rows = await query<TarotRow>(
    "SELECT id, title, spread_name, question, created_at FROM readings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [session.userId, SHOWN + 1]
  );
  const readings = rows.slice(0, SHOWN);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Tarot</PageTitle>
        <div className="flex gap-2 flex-wrap">
          <ButtonLink href="/readings/new" variant="primary">
            New reading
          </ButtonLink>
          <ButtonLink href="/readings/new?mode=manual" variant="quiet">
            Record my own deck
          </ButtonLink>
          <ButtonLink href="/tarot/practice" variant="quiet">
            Practice with a sealed card
          </ButtonLink>
        </div>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Draw cards from the 78-card tarot, or record cards you drew by hand from a deck of your own. The app picks by
        chance. What each card means is yours to write; the traditional meanings open only when you press their button.{" "}
        <Link href="/library" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">The tarot library</Link>
      </p>

      <section aria-labelledby="past-readings" className="space-y-3">
        <SectionLabel id="past-readings">Past readings</SectionLabel>
        {readings.length === 0 ? (
          <p className="text-sm text-ink-ghost">No readings are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {readings.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/readings/${r.id}`}
                  className="block bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-medium text-ink-strong break-words min-w-0">{r.title || r.spread_name}</p>
                    <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(r.created_at)}>
                      {parseDate(r.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  <p className="text-xs text-ink-faint mt-0.5">{r.spread_name}</p>
                  {r.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{r.question}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-faint">
          {rows.length > SHOWN ? `Showing the latest ${SHOWN}. ` : ""}
          <Link href="/readings" className="underline hover:text-accent-ink">Every reading, from every tool</Link>
        </p>
      </section>

      <SourcesLine tool="tarot" />
    </Page>
  );
}

export const metadata = { title: "Tarot" };
