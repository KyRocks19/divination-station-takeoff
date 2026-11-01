import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { listDraws } from "@/lib/runes";
import RuneGlyph from "@/components/runes/RuneGlyph";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function RunesPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const draws = await listDraws(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Runes</PageTitle>
        <ButtonLink href="/runes/new" variant="primary">
          Draw some runes
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Draw one rune or several from the 24 runes of the Elder Futhark. The app picks by chance. What each rune means is
        yours to write; the traditional meanings open only when you press their button.{" "}
        <Link href="/runes/set" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">The 24 runes</Link>
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
                  href={`/runes/${d.id}`}
                  className="flex items-center gap-4 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                >
                  <div className="flex gap-1 flex-shrink-0 text-tone-300" aria-hidden="true">
                    {d.runes.slice(0, 3).map((r, i) => (
                      <RuneGlyph key={i} runeId={r.rune_id} reversed={r.reversed} decorative className="w-5 h-9" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-medium text-ink-strong break-words min-w-0">
                        {d.runes.map((r) => r.rune_name + (r.reversed ? " (upside down)" : "")).join(", ")}
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
      <SourcesLine tool="runes" />
    </Page>
  );
}

export const metadata = { title: "Runes" };
