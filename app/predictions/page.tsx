import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate } from "@/lib/date";
import { DIVINATION_KINDS, DIVINATION_KIND_LABELS, divinationPath } from "@/lib/divination-kinds";
import ToolGlyph from "@/components/ui/ToolGlyph";
import { MIN_FOR_PERCENT, OUTCOME_LABELS, answered, listAll, percentages, tallyByKind, type ListedPrediction } from "@/lib/predictions";
import { FIT_LABELS, MIN_FITS_FOR_AVERAGE, averageFit } from "@/lib/guess-core";
import { countByKind, listWrittenGuesses } from "@/lib/guesses";
import { BackLink, PageTitle, SectionLabel } from "@/components/ui/Page";
import { Card, CardLink } from "@/components/ui/Card";

const today = () => new Date().toLocaleDateString("en-CA");

function Row({ p }: { p: ListedPrediction }) {
  return (
    <li>
      <CardLink href={divinationPath(p.kind, p.divination_id, p.reading_id)} lift>
        <p className="text-sm text-ink-strong whitespace-pre-wrap break-words line-clamp-3">{p.text}</p>
        <p className="text-xs text-ink-faint mt-1">
          {DIVINATION_KIND_LABELS[p.kind]} · written {parseDate(p.created_at).toLocaleDateString()}
          {p.outcome ? ` · ${OUTCOME_LABELS[p.outcome]}` : p.check_on ? ` · look back on ${parseDate(`${p.check_on}T12:00:00`).toLocaleDateString()}` : ""}
        </p>
      </CardLink>
    </li>
  );
}

export default async function PredictionsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const all = await listAll(session.userId);

  const now = today();
  const due = all.filter((p) => !p.outcome && p.check_on && p.check_on <= now);
  const waiting = all.filter((p) => !p.outcome && !(p.check_on && p.check_on <= now));
  const looked = all.filter((p) => p.outcome);
  const tallies = tallyByKind(all);
  const guesses = await listWrittenGuesses(session.userId);
  const guessCounts = countByKind(guesses);

  return (
    <div className="max-w-page mx-auto px-4 pt-8 pb-16 space-y-6">
      <div className="space-y-1">
        <BackLink href="/library">← Library</BackLink>
        <PageTitle>Your predictions</PageTitle>
      </div>
      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        What you sensed before a reading opened, written down and sealed at the time, and what you decided happened afterwards. Each reading asks for it once, at the start.
        Only you say whether it came true. The numbers are a mirror of your own practice, to help you see how your impressions run, and not a score.
      </p>

      {all.length === 0 && guesses.length === 0 && <p className="text-sm text-ink-ghost">Nothing yet. Start a reading and write what you sense before it opens.</p>}

      {tallies.size > 0 && (
        <section aria-label="Counts for each tool" className="space-y-3">
          <SectionLabel>How each tool has gone, by your own account</SectionLabel>
          <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
            {DIVINATION_KINDS.filter((k) => tallies.has(k)).map((k) => {
              const t = tallies.get(k)!;
              const pct = percentages(t);
              return (
                <li key={k}>
                  <Card pad="sm" className="space-y-1">
                    <p className="font-medium text-ink-strong"><ToolGlyph kind={k} className="inline-block h-[1.1em] w-[1.1em] align-text-bottom" /> {DIVINATION_KIND_LABELS[k]}</p>
                    <p className="text-sm text-ink-soft">
                      {t.yes} came true, {t.partly} partly, {t.no} did not
                      {t.unclear > 0 ? `, ${t.unclear} could not be told` : ""}
                      {t.open > 0 ? `; ${t.open} still waiting` : ""}.
                    </p>
                    <p className="text-xs text-ink-ghost">
                      {pct
                        ? `Of ${answered(t)} you could judge: ${pct.yes}% came true, ${pct.partly}% partly, ${pct.no}% did not. The more specific you are when you write, the more a result can teach you.`
                        : `A percentage appears after ${MIN_FOR_PERCENT} you could judge. ${answered(t)} so far; a few are too few to read much into.`}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {guesses.length > 0 && (
        <section aria-label="What you sensed first" className="space-y-3">
          <SectionLabel>What you sensed first</SectionLabel>
          <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
            The words you wrote before opening a reading&apos;s meanings, and how well you said they fitted afterwards. Only you say how well. This is a mirror of
            your own practice, not a score.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
            {DIVINATION_KINDS.filter((k) => guessCounts.has(k)).map((k) => {
              const c = guessCounts.get(k)!;
              const avg = averageFit(c);
              return (
                <li key={k}>
                  <Card pad="sm" className="space-y-1">
                    <p className="font-medium text-ink-strong"><ToolGlyph kind={k} className="inline-block h-[1.1em] w-[1.1em] align-text-bottom" /> {DIVINATION_KIND_LABELS[k]}</p>
                    <p className="text-sm text-ink-soft">
                      {c.written} written first; you have said how well {c.rated} fitted
                      {avg !== null ? `, on average ${avg} out of 5` : ""}.
                    </p>
                    {avg === null && (
                      <p className="text-xs text-ink-ghost">An average appears after {MIN_FITS_FOR_AVERAGE} you have said how well they fitted. {c.rated} so far; a few are too few to read much into.</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <ul className="space-y-2 list-none p-0">
            {guesses.map((g) => (
              <li key={g.divination_id}>
                <CardLink href={divinationPath(g.kind, g.divination_id, g.reading_id)} lift>
                  <p className="text-sm text-ink-strong whitespace-pre-wrap break-words line-clamp-3">{g.guess}</p>
                  <p className="text-xs text-ink-faint mt-1">
                    {DIVINATION_KIND_LABELS[g.kind]} · sealed {parseDate(g.sealed_at).toLocaleDateString()}
                    {g.fit ? ` · fitted: ${FIT_LABELS[g.fit]}` : " · not yet said how well it fitted"}
                  </p>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {due.length > 0 && (
        <section aria-label="Ready to look back on" className="space-y-2">
          <SectionLabel>Ready to look back on</SectionLabel>
          <ul className="space-y-2 list-none p-0">{due.map((p) => <Row key={p.id} p={p} />)}</ul>
        </section>
      )}
      {waiting.length > 0 && (
        <section aria-label="Still waiting" className="space-y-2">
          <SectionLabel>Still waiting</SectionLabel>
          <ul className="space-y-2 list-none p-0">{waiting.map((p) => <Row key={p.id} p={p} />)}</ul>
        </section>
      )}
      {looked.length > 0 && (
        <section aria-label="Looked back on" className="space-y-2">
          <SectionLabel>Looked back on</SectionLabel>
          <ul className="space-y-2 list-none p-0">{looked.map((p) => <Row key={p.id} p={p} />)}</ul>
        </section>
      )}
    </div>
  );
}

export const metadata = { title: "Predictions" };
