import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { PLAYING_CARDS, PLAYING_CARD_WORDS, SUITS } from "@/lib/playingcards-data";
import CardFace from "@/components/playingcards/CardFace";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";

export default async function PlayingSetPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // Which cards the person has written their own words for.
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND card_id LIKE 'playing-%'
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(upright_description), '') <> '')`,
    [session.userId]
  );
  const hasWords = new Set(written.map((w) => w.card_id));

  return (
    <Page>
      <BackLink href="/playingcards">← Playing cards</BackLink>
      <PageTitle>The 52 cards</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        {PLAYING_CARD_WORDS.here} You have written words for {hasWords.size} of 52.
      </p>
      {SUITS.map((s) => (
        <section key={s.id} aria-labelledby={`suit-${s.id}`} className="space-y-3">
          <SectionLabel id={`suit-${s.id}`}>{s.name}</SectionLabel>
          <ul className="grid grid-cols-3 sm:grid-cols-5 gap-3 list-none p-0">
            {PLAYING_CARDS.filter((c) => c.suit === s.id).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/playingcards/set/${c.id}`}
                  className="flex flex-col items-center gap-1 bg-surface border border-line rounded-card p-2 hover:border-line-hover transition-colors"
                >
                  <CardFace cardId={c.id} className="w-14 h-20" />
                  <span className="text-xs text-ink-strong text-center">{c.name}</span>
                  <span className="text-[10px] text-tone-500 h-3">{hasWords.has(c.meaningId) ? "Your words" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}

export const metadata = { title: "The 52 playing cards" };
