import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { FIGURES, GEOMANCY_SOURCES } from "@/lib/geomancy";
import FigureGlyph from "@/components/geomancy/FigureGlyph";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function FigureSetPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // Which figures the person has written their own words for.
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND card_id LIKE 'geomancy-%'
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(reversed_keywords), '') <> ''
         OR COALESCE(TRIM(upright_description), '') <> '' OR COALESCE(TRIM(reversed_description), '') <> '')`,
    [session.userId]
  );
  const hasWords = new Set(written.map((w) => w.card_id));

  return (
    <Page>
      <BackLink href="/geomancy">← Geomancy</BackLink>
      <PageTitle>The 16 figures</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        {GEOMANCY_SOURCES.figures} Open a figure to write what it means to you. You have written words for {hasWords.size} of 16.
      </p>

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0">
        {FIGURES.map((f) => (
          <li key={f.id}>
            <Link
              href={`/geomancy/set/${f.id.slice(9)}`}
              className="flex flex-col items-center gap-2 bg-surface border border-line rounded-card p-3 hover:border-line-hover transition-colors"
            >
              <FigureGlyph figure={f} decorative className="w-8 h-14 text-tone-200" />
              <span className="text-sm text-ink-strong text-center">{f.latin}</span>
              <span className="text-[11px] text-ink-faint text-center">{f.english}</span>
              <span className="text-[10px] text-tone-500 h-3">{hasWords.has(f.id) ? "Your words" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export const metadata = { title: "Your geomantic figures" };
