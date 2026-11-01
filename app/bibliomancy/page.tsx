import SourcesLine from "@/components/sources/SourcesLine";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { listReadings, BIBLIOMANCY_SOURCES } from "@/lib/bibliomancy";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function BibliomancyPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const readings = await listReadings(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Bibliomancy</PageTitle>
        <ButtonLink href="/bibliomancy/new" variant="primary">
          Pull from your writing
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">{BIBLIOMANCY_SOURCES.history}</p>
      <p className="text-sm text-ink-muted leading-relaxed">{BIBLIOMANCY_SOURCES.here}</p>

      <section aria-labelledby="past-pulls" className="space-y-3">
        <SectionLabel id="past-pulls">Past pulls{readings.length > 0 ? ` (${readings.length})` : ""}</SectionLabel>
        {readings.length === 0 ? (
          <p className="text-sm text-ink-ghost">No pulls are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {readings.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/bibliomancy/${r.id}`}
                  className="block bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-medium text-ink-strong break-words min-w-0 line-clamp-2">
                      {r.pulls.map((p) => `“${p.passage}”`).join(", ")}
                    </p>
                    <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(r.created_at)}>
                      {parseDate(r.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  {r.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{r.question}</p>}
                  {r.entry_count > 0 && (
                    <p className="text-xs text-tone-500 mt-1">
                      {r.entry_count} entr{r.entry_count !== 1 ? "ies" : "y"}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SourcesLine tool="bibliomancy" />
    </Page>
  );
}

export const metadata = { title: "Bibliomancy" };
