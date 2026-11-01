import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getRuneSettings, getRune } from "@/lib/runes";
import RuneGlyph from "@/components/runes/RuneGlyph";
import RuneMeanings from "@/components/runes/RuneMeanings";
import PieceHistory from "@/components/PieceHistory";
import { BackLink, Page } from "@/components/ui/Page";

export default async function RunePage({ params }: { params: Promise<{ runeId: string }> }) {
  const { runeId } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const rune = getRune(runeId);
  if (!rune) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Rune not found.</p>
        <BackLink href="/runes/set">
          ← The 24 runes
        </BackLink>
      </div>
    );
  }

  // The upside-down side is shown only when the person has reversals on and this rune can land that way.
  const settings = await getRuneSettings(session.userId);
  const orientation = settings.reversals && rune.canReverse ? undefined : "upright";

  return (
    <Page>
      <BackLink href="/runes/set">
        ← The 24 runes
      </BackLink>

      <header className="flex items-center gap-5">
        <RuneGlyph runeId={rune.id} className="w-14 h-24 flex-shrink-0 text-tone-200" />
        <h1 className="text-3xl font-bold text-tone-100 break-words min-w-0">{rune.name}</h1>
      </header>

      <RuneMeanings runeId={rune.id} orientation={orientation} />

      <PieceHistory userId={session.userId} kind="runes" pieceKey={rune.id} noun="rune" readingWord="draw" />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/runes/new" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Draw some runes</Link>
        <Link href="/runes" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Past draws</Link>
      </div>
    </Page>
  );
}

export const metadata = { title: "A rune" };
