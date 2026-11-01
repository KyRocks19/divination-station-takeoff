import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { listDraws } from "@/lib/ogham";
import StaveGlyph from "@/components/ogham/StaveGlyph";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function OghamPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const draws = await listDraws(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Ogham</PageTitle>
        <ButtonLink href="/ogham/new" variant="primary">
          Draw some staves
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Draw one stave or several from the 20 ogham letters, or 25 with the five later ones. The app picks by chance. What each stave means is
        yours to write; the traditional meanings open only when you press their button.{" "}
        <Link href="/ogham/set" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">The ogham letters</Link>
      </p>

      <section aria-labelledby="past-draws" className="space-y-3">
        <SectionLabel id="past-draws">
          Past draws{draws.length > 0 ? ` (${draws.length})` : ""}
        </SectionLabel>
        {draws.length === 0 ? (
          <p className="text-sm text-ink-ghost">No draws are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {draws.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/ogham/${d.id}`}
                  className="flex items-center gap-4 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                >
                  <div className="flex gap-1 flex-shrink-0 text-tone-300" aria-hidden="true">
                    {d.staves.slice(0, 3).map((r, i) => (
                      <StaveGlyph key={i} staveId={r.stave_id} decorative className="w-5 h-9" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-medium text-ink-strong break-words min-w-0">
                        {d.staves.map((r) => r.stave_name).join(", ")}
                      </p>
                      <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(d.created_at)}>
                        {parseDate(d.created_at).toLocaleDateString()}
                      </time>
                    </div>
                    {d.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{d.question}</p>}
                    {d.entry_count > 0 && (
                      <p className="text-xs text-tone-500 mt-1">
                        {d.entry_count} entr{d.entry_count !== 1 ? "ies" : "y"}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SourcesLine tool="ogham" />
    </Page>
  );
}

export const metadata = { title: "Ogham" };
