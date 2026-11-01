import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { listThrows, throwLine } from "@/lib/dice";
import DiceHistory from "@/components/dice/DiceHistory";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { CardLink } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default async function DicePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const throws = await listThrows(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Dice and coins</PageTitle>
        <ButtonLink href="/dice/new" variant="primary">
          Throw some dice
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Throw a coin or dice. The app picks each face by chance. What each face means is yours to write, and nothing is
        scored.{" "}
        <Link href="/dice/set" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">What the faces mean to you</Link>
      </p>

      <DiceHistory />

      <section aria-labelledby="past-throws" className="space-y-3">
        <SectionLabel id="past-throws">
          Past throws{throws.length > 0 ? ` (${throws.length})` : ""}
        </SectionLabel>
        {throws.length === 0 ? (
          <p className="text-sm text-ink-ghost">No throws are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {throws.map((t) => (
              <li key={t.id}>
                <CardLink href={`/dice/${t.id}`}>
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-medium text-ink-strong break-words min-w-0">
                      {throwLine(t.results, 12)}
                    </p>
                    <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(t.created_at)}>
                      {parseDate(t.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  {t.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{t.question}</p>}
                  {t.entry_count > 0 && (
                    <p className="text-xs text-tone-500 mt-1">
                      {t.entry_count} entr{t.entry_count !== 1 ? "ies" : "y"}
                    </p>
                  )}
                </CardLink>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SourcesLine tool="dice" />
    </Page>
  );
}

export const metadata = { title: "Dice and coins" };
