import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { getFigure, listCharts } from "@/lib/geomancy";
import FigureGlyph from "@/components/geomancy/FigureGlyph";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function GeomancyPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const charts = await listCharts(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Geomancy</PageTitle>
        <ButtonLink href="/geomancy/new" variant="primary">
          Cast a chart
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Cast sixteen lines of dots, or choose the four Mothers yourself, and see the chart of sixteen figures they make, with the Judge as its answer. What each of the
        sixteen figures means is yours to write; what the sources fix about it (its Latin name and its dots) opens only when you press its button.{" "}
        <Link href="/geomancy/set" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">The 16 figures</Link>
      </p>

      <section aria-labelledby="past-charts" className="space-y-3">
        <SectionLabel id="past-charts">Past charts{charts.length > 0 ? ` (${charts.length})` : ""}</SectionLabel>
        {charts.length === 0 ? (
          <p className="text-sm text-ink-ghost">No charts are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {charts.map((c) => {
              const judge = c.figures.find((f) => f.place === "judge");
              const judgeFigure = judge ? getFigure(judge.figure_id) : undefined;
              return (
                <li key={c.id}>
                  <Link
                    href={`/geomancy/${c.id}`}
                    className="flex items-center gap-4 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                  >
                    {judgeFigure && (
                      <div className="flex-shrink-0 text-tone-300" aria-hidden="true">
                        <FigureGlyph figure={judgeFigure} decorative className="w-6 h-10" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-medium text-ink-strong break-words min-w-0">Judge: {judge?.figure_name ?? "unknown"}</p>
                        <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(c.created_at)}>
                          {parseDate(c.created_at).toLocaleDateString()}
                        </time>
                      </div>
                      {c.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{c.question}</p>}
                      {c.entry_count > 0 && (
                        <p className="text-xs text-tone-500 mt-1">
                          {c.entry_count} entr{c.entry_count !== 1 ? "ies" : "y"}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <SourcesLine tool="geomancy" />
    </Page>
  );
}

export const metadata = { title: "Geomancy" };
