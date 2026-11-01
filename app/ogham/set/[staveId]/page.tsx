import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStave } from "@/lib/ogham";
import { ownNames } from "@/lib/own-names";
import StaveHeading from "@/components/ogham/StaveHeading";
import StaveMeanings from "@/components/ogham/StaveMeanings";
import PieceHistory from "@/components/PieceHistory";
import { BackLink, Page } from "@/components/ui/Page";

export default async function StavePage({ params }: { params: Promise<{ staveId: string }> }) {
  const { staveId } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const stave = getStave(staveId);
  if (!stave) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Stave not found.</p>
        <BackLink href="/ogham/set">
          ← The ogham letters
        </BackLink>
      </div>
    );
  }

  return (
    <Page>
      <BackLink href="/ogham/set">
        ← The ogham letters
      </BackLink>

      <StaveHeading staveId={stave.id} initialName={(await ownNames(session.userId, [stave.id]))[stave.id] ?? null} />

      <StaveMeanings staveId={stave.id} />

      <PieceHistory userId={session.userId} kind="ogham" pieceKey={stave.id} noun="stave" readingWord="draw" />

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/ogham/new" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Draw some staves</Link>
        <Link href="/ogham" className="text-xs text-accent-ink hover:text-accent-ink-hover transition-colors">Past draws</Link>
      </div>
    </Page>
  );
}

export const metadata = { title: "An ogham stave" };
