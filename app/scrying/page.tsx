import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { isScryingSurface, listSessions, surfaceLabel } from "@/lib/scrying";
import Surface from "@/components/scrying/Surface";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function ScryingPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const sessions = await listSessions(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Scrying</PageTitle>
        <ButtonLink href="/scrying/new" variant="primary">
          Open a surface
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Look into a dark mirror, a crystal ball, or a bowl of water for as long as you like, then write what you
        saw. The app does not say what any shape is. What you see is yours.
      </p>

      <section aria-labelledby="past-sessions" className="space-y-3">
        <SectionLabel id="past-sessions">
          Past sessions{sessions.length > 0 ? ` (${sessions.length})` : ""}
        </SectionLabel>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-ghost">No sessions are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/scrying/${s.id}`}
                  className="flex items-center gap-4 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                >
                  {isScryingSurface(s.surface) && (
                    <Surface surface={s.surface} moving={false} className="w-12 h-12 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-medium text-ink-strong">{surfaceLabel(s.surface)}</p>
                      <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(s.created_at)}>
                        {parseDate(s.created_at).toLocaleDateString()}
                      </time>
                    </div>
                    {s.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{s.question}</p>}
                    {s.entry_count > 0 && (
                      <p className="text-xs text-tone-500 mt-1">
                        {s.entry_count} entr{s.entry_count !== 1 ? "ies" : "y"}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SourcesLine tool="scrying" />
    </Page>
  );
}

export const metadata = { title: "Scrying" };
