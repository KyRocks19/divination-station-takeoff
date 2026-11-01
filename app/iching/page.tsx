import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { getHexagram, listCasts, resultOf } from "@/lib/iching";
import HexagramGlyph from "@/components/iching/HexagramGlyph";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export default async function IChingPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const casts = await listCasts(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>I Ching</PageTitle>
        <ButtonLink href="/iching/new" variant="primary">
          Cast the I Ching
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        Cast six lines with three coins or yarrow stalks, or type in a cast you made yourself, and see the hexagram they make and the one it turns into.
        What each of the 64 hexagrams means is yours to write; what the tradition fixes about it (its name and trigrams) opens only when you press its button.{" "}
        <Link href="/iching/set" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">The 64 hexagrams</Link>
      </p>

      <section aria-labelledby="past-casts" className="space-y-3">
        <SectionLabel id="past-casts">Past casts{casts.length > 0 ? ` (${casts.length})` : ""}</SectionLabel>
        {casts.length === 0 ? (
          <p className="text-sm text-ink-ghost">No casts are saved.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {casts.map((c) => {
              const r = resultOf(c.lines);
              return (
                <li key={c.id}>
                  <Link
                    href={`/iching/${c.id}`}
                    className="flex items-center gap-4 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
                  >
                    <div className="flex gap-2 flex-shrink-0 text-tone-300" aria-hidden="true">
                      <HexagramGlyph lines={r.primary.lines} values={c.lines} decorative label="" className="w-9 h-9" />
                      {r.relating && <HexagramGlyph lines={r.relating.lines} decorative label="" className="w-9 h-9" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-medium text-ink-strong break-words min-w-0">
                          {r.primary.n} {r.primary.pinyin}
                          {r.relating ? ` → ${r.relating.n} ${r.relating.pinyin}` : ""}
                        </p>
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
      <SourcesLine tool="iching" />
    </Page>
  );
}

export const metadata = { title: "I Ching" };
