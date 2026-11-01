import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { AICME_NAMES, OGHAM_SOURCES, STAVES } from "@/lib/ogham";
import StaveGlyph from "@/components/ogham/StaveGlyph";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";

export default async function OghamSetPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // Which staves the person has written their own words for.
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND card_id LIKE 'ogham-%'
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(upright_description), '') <> '')`,
    [session.userId]
  );
  const hasWords = new Set(written.map((w) => w.card_id));

  return (
    <Page>
      <BackLink href="/ogham">
        ← Ogham
      </BackLink>
      <PageTitle>The ogham letters</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        {OGHAM_SOURCES.ogham} Open a stave to write what it means to you. You have written words for {hasWords.size} of{" "}
        {STAVES.length}.
      </p>

      {([1, 2, 3, 4, 0] as const).map((aicme) => (
        <section key={aicme} aria-labelledby={`aicme-${aicme}`} className="space-y-3">
          <SectionLabel id={`aicme-${aicme}`}>{AICME_NAMES[aicme]}</SectionLabel>
          <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3 list-none p-0">
            {STAVES.filter((s) => s.aicme === aicme).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/ogham/set/${s.id}`}
                  className="flex flex-col items-center gap-2 bg-surface border border-line rounded-card p-3 hover:border-line-hover transition-colors"
                >
                  <StaveGlyph staveId={s.id} decorative className="w-8 h-14 text-tone-200" />
                  <span className="text-sm text-ink-strong">{s.name}</span>
                  <span className="text-[10px] text-tone-500 h-3">{hasWords.has(s.id) ? "Your words" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}

export const metadata = { title: "Your ogham staves" };
