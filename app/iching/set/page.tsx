import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { HEXAGRAMS, ICHING_SOURCES } from "@/lib/iching";
import HexagramGlyph from "@/components/iching/HexagramGlyph";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function HexagramSetPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // Which hexagrams the person has written their own words for.
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND card_id LIKE 'hexagram-%'
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(reversed_keywords), '') <> ''
         OR COALESCE(TRIM(upright_description), '') <> '' OR COALESCE(TRIM(reversed_description), '') <> '')`,
    [session.userId]
  );
  const hasWords = new Set(written.map((w) => w.card_id));

  return (
    <Page>
      <BackLink href="/iching">← I Ching</BackLink>
      <PageTitle>The 64 hexagrams</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        {ICHING_SOURCES.hexagrams} Open a hexagram to write what it means to you. You have written words for {hasWords.size} of 64.
      </p>

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0">
        {HEXAGRAMS.map((h) => (
          <li key={h.n}>
            <Link
              href={`/iching/set/${h.n}`}
              className="flex flex-col items-center gap-2 bg-surface border border-line rounded-card p-3 hover:border-line-hover transition-colors"
            >
              <HexagramGlyph lines={h.lines} decorative label="" className="w-10 h-10 text-tone-200" />
              <span className="text-sm text-ink-strong text-center">
                {h.n}. {h.pinyin}
              </span>
              <span className="text-[11px] text-ink-faint text-center">{h.english}</span>
              <span className="text-[10px] text-tone-500 h-3">{hasWords.has(h.id) ? "Your words" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export const metadata = { title: "Your hexagrams" };
