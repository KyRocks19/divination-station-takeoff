import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getFigure } from "@/lib/geomancy-data";
import FigureGlyph from "@/components/geomancy/FigureGlyph";
import FigureMeanings from "@/components/geomancy/FigureMeanings";
import PieceHistory from "@/components/PieceHistory";
import { BackLink, Page } from "@/components/ui/Page";

export default async function FigurePage({ params }: { params: Promise<{ figure: string }> }) {
  const { figure } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const f = getFigure(`geomancy-${figure}`);
  if (!f) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Figure not found.</p>
        <BackLink href="/geomancy/set">← The 16 figures</BackLink>
      </div>
    );
  }

  return (
    <Page>
      <BackLink href="/geomancy/set">← The 16 figures</BackLink>

      <header className="flex items-center gap-5">
        <FigureGlyph figure={f} className="w-14 h-24 flex-shrink-0 text-tone-200" />
        <h1 className="text-3xl font-bold text-tone-100 break-words min-w-0">{f.latin}</h1>
      </header>

      <FigureMeanings figureId={f.id} />

      <PieceHistory userId={session.userId} kind="geomancy" pieceKey={f.id} noun="figure" readingWord="chart" />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/geomancy/new" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Cast a chart</Link>
        <Link href="/geomancy" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Past charts</Link>
      </div>
    </Page>
  );
}

export const metadata = { title: "A geomantic figure" };
