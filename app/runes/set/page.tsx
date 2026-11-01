import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { AETT_NAMES, RUNES, RUNE_SOURCES } from "@/lib/runes";
import RuneGlyph from "@/components/runes/RuneGlyph";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";

export default async function RuneSetPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // Which runes the person has written their own words for.
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND card_id LIKE 'rune-%'
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(reversed_keywords), '') <> ''
         OR COALESCE(TRIM(upright_description), '') <> '' OR COALESCE(TRIM(reversed_description), '') <> '')`,
    [session.userId]
  );
  const hasWords = new Set(written.map((w) => w.card_id));

  return (
    <Page>
      <BackLink href="/runes">
        ← Runes
      </BackLink>
      <PageTitle>The 24 runes</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        {RUNE_SOURCES.futhark} Open a rune to write what it means to you. You have written words for {hasWords.size} of 24.
      </p>

      {([1, 2, 3] as const).map((aett) => (
        <section key={aett} aria-labelledby={`aett-${aett}`} className="space-y-3">
          <SectionLabel id={`aett-${aett}`}>{AETT_NAMES[aett]}</SectionLabel>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0">
            {RUNES.filter((r) => r.aett === aett).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/runes/set/${r.id}`}
                  className="flex flex-col items-center gap-2 bg-surface border border-line rounded-card p-3 hover:border-line-hover transition-colors"
                >
                  <RuneGlyph runeId={r.id} decorative className="w-8 h-14 text-tone-200" />
                  <span className="text-sm text-ink-strong">{r.name}</span>
                  <span className="text-[10px] text-tone-500 h-3">{hasWords.has(r.id) ? "Your words" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}

export const metadata = { title: "Your runes" };
