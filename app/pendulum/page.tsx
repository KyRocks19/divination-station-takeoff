import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { listAnswers } from "@/lib/pendulum";
import PendulumBoard from "@/components/pendulum/PendulumBoard";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function PendulumPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const answers = await listAnswers(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Pendulum</PageTitle>
        <ButtonLink href="/pendulum/new" variant="primary">
          Ask the pendulum
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Ask a question and watch a swing. The app picks the swing by chance. What each swing means is yours to write.{" "}
        <Link href="/pendulum/swings" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">Your swings</Link>
      </p>

      <section aria-labelledby="past-answers" className="space-y-3">
        <SectionLabel id="past-answers">
          Past answers{answers.length > 0 ? ` (${answers.length})` : ""}
        </SectionLabel>
        {answers.length === 0 ? (
          <p className="text-sm text-ink-ghost">No answers are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {answers.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/pendulum/${a.id}`}
                  className="flex items-center gap-4 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                >
                  <PendulumBoard
                    shape={a.shape}
                    angle={a.angle}
                    label={a.swing_name}
                    moving={false}
                    className="w-12 h-12 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-medium text-ink-strong break-words min-w-0">{a.swing_name}</p>
                      <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(a.created_at)}>
                        {parseDate(a.created_at).toLocaleDateString()}
                      </time>
                    </div>
                    {a.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{a.question}</p>}
                    {a.entry_count > 0 && (
                      <p className="text-xs text-tone-500 mt-1">
                        {a.entry_count} entr{a.entry_count !== 1 ? "ies" : "y"}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SourcesLine tool="pendulum" />
    </Page>
  );
}

export const metadata = { title: "Pendulum" };
