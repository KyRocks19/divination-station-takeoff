import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHexagram } from "@/lib/iching-data";
import HexagramGlyph from "@/components/iching/HexagramGlyph";
import HexagramMeanings from "@/components/iching/HexagramMeanings";
import PieceHistory from "@/components/PieceHistory";
import { BackLink, Page } from "@/components/ui/Page";
import Hanzi from "@/components/ui/Hanzi";

export default async function HexagramPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const h = getHexagram(/^\d{1,2}$/.test(n) ? Number(n) : -1);
  if (!h) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Hexagram not found.</p>
        <BackLink href="/iching/set">← The 64 hexagrams</BackLink>
      </div>
    );
  }

  return (
    <Page>
      <BackLink href="/iching/set">← The 64 hexagrams</BackLink>

      <header className="flex items-center gap-5">
        <HexagramGlyph lines={h.lines} label={`Hexagram ${h.n}, ${h.pinyin}`} className="w-20 h-20 flex-shrink-0 text-tone-200" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-tone-100 break-words">{h.pinyin}</h1>
          <p className="text-sm text-ink-faint">Hexagram {h.n} · <Hanzi>{h.char}</Hanzi></p>
        </div>
      </header>

      <HexagramMeanings hexagram={h.n} />

      <PieceHistory userId={session.userId} kind="iching" pieceKey={h.id} noun="hexagram" readingWord="cast" />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/iching/new" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Cast the I Ching</Link>
        <Link href="/iching" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Past casts</Link>
        {h.n > 1 && <Link href={`/iching/set/${h.n - 1}`} className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Hexagram {h.n - 1}</Link>}
        {h.n < 64 && <Link href={`/iching/set/${h.n + 1}`} className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Hexagram {h.n + 1}</Link>}
      </div>
    </Page>
  );
}

export const metadata = { title: "A hexagram" };
