import SourcesLine from "@/components/sources/SourcesLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listDraws, PLAYING_CARD_WORDS } from "@/lib/playingcards";
import ReadingList from "@/components/tools/ReadingList";

export default async function PlayingCardsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const draws = await listDraws(session.userId);

  return (
    <>
      <ReadingList
        title="Playing cards"
        newHref="/playingcards/new"
        newLabel="Draw cards"
        intro={[PLAYING_CARD_WORDS.here]}
        listLabel="Past draws"
        emptyText="No draws are saved."
        items={draws.map((d) => ({
          id: d.id,
          href: `/playingcards/${d.id}`,
          headline: d.cards.map((c) => c.card_name).join(", "),
          question: d.question,
          created_at: d.created_at,
          entry_count: d.entry_count,
        }))}
        extra={
          <p className="text-sm">
            <Link href="/playingcards/set" className="text-accent-ink hover:text-accent-ink-hover">The 52 cards and your own meanings</Link>
          </p>
        }
      />
      <div className="max-w-page mx-auto px-4 pb-8">
        <SourcesLine tool="playingcards" />
      </div>
    </>
  );
}

export const metadata = { title: "Playing cards" };
