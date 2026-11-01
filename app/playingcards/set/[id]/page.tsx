import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCard } from "@/lib/playingcards-data";
import CardFace from "@/components/playingcards/CardFace";
import CardMeanings from "@/components/playingcards/CardMeanings";
import PieceHistory from "@/components/PieceHistory";
import { BackLink, Page } from "@/components/ui/Page";

export default async function PlayingCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const card = getCard(id);
  if (!card) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Card not found.</p>
        <BackLink href="/playingcards/set">← The 52 cards</BackLink>
      </div>
    );
  }

  return (
    <Page>
      <BackLink href="/playingcards/set">← The 52 cards</BackLink>
      <header className="flex items-center gap-5">
        <CardFace cardId={card.id} />
        <h1 className="text-3xl font-bold text-tone-100 break-words min-w-0">{card.name}</h1>
      </header>
      <CardMeanings cardId={card.id} />
      <PieceHistory userId={session.userId} kind="playingcards" pieceKey={card.meaningId} noun="card" readingWord="draw" />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/playingcards/new" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Draw playing cards</Link>
        <Link href="/playingcards" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Past draws</Link>
      </div>
    </Page>
  );
}

export const metadata = { title: "A playing card" };
