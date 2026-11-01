import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate } from "@/lib/date";
import { FIT_LABELS, type Fit } from "@/lib/guess-core";
import { questionGroups } from "@/lib/reading-extras";
import { BackLink, PageTitle } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

// One question, several tools (release plan §6 idea 5): every question the person asked in more than one reading, with what they sensed first
// in each, side by side. Only their own words; the page does not compare or judge them.
export default async function QuestionsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const groups = await questionGroups(session.userId);

  return (
    <div className="max-w-page mx-auto px-4 pt-8 pb-16 space-y-6">
      <div className="space-y-1">
        <BackLink href="/insights">← Insights</BackLink>
        <PageTitle>Questions you asked more than once</PageTitle>
      </div>
      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        When you ask the same question with different tools, or on different days, here is what you sensed first each time, in your own words. A
        question counts as the same when its words are the same (capitals and spaces aside). Where your answers differ is yours to think about.
      </p>
      {groups.length === 0 && (
        <p className="text-sm text-ink-ghost">Nothing yet. Ask the same question in two readings, with any tools, and it appears here.</p>
      )}
      <ul className="space-y-4 list-none p-0">
        {groups.map((g) => (
          <li key={g.question}>
            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-strong break-words">{g.question}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
                {g.readings.map((r) => (
                  <li key={r.id} className="border-l-2 border-line pl-3 space-y-0.5">
                    <Link href={r.href} className="text-xs text-accent-ink hover:text-accent-ink-hover underline">
                      {r.tool}, {parseDate(r.when).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </Link>
                    <p className="text-sm text-ink-soft whitespace-pre-wrap break-words">
                      {r.guess ?? <span className="text-ink-ghost">Nothing written first.</span>}
                    </p>
                    {r.fit && <p className="text-xs text-ink-faint">You said it fitted: {FIT_LABELS[r.fit as Fit].toLowerCase()}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const metadata = { title: "Questions" };
