import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listCardPulls, listDecks, listFieldNames, loadCard, toId, type OracleCard, type OracleCardPull } from "@/lib/oracle";
import OracleCardEditor from "@/components/oracle/OracleCardEditor";
import { BackLink } from "@/components/ui/Page";
import { aiReadyFor } from "@/lib/ai-ready";
import { imageMode } from "@/lib/image-queue";
import { artDir } from "@/lib/art-store";

/** How many of the times an item came up the card's page lists. */
const PULLS_SHOWN = 30;

export default async function OracleCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const cardId = toId(id);
  const [card, prefs, fieldNames, decks, pulls, ai] = await Promise.all([
    loadCard(session.userId, cardId),
    getPrefs(session.userId),
    listFieldNames(session.userId),
    listDecks(session.userId),
    // One more than the page shows, so it can say there are earlier ones.
    listCardPulls(session.userId, cardId, 0, PULLS_SHOWN + 1),
    aiReadyFor(session.userId),
  ]);
  if (!card) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Card not found.</p>
        <BackLink href="/oracle">
          ← Oracle deck
        </BackLink>
      </div>
    );
  }

  // Dates become text here, so the editor starts with the same shape the API returns.
  const initialCard: OracleCard = JSON.parse(JSON.stringify(card));
  const allPulls: OracleCardPull[] = JSON.parse(JSON.stringify(pulls));
  return (
    <OracleCardEditor
      initialCard={initialCard}
      sets={decks.map((d) => ({ id: d.id, name: d.name, form: d.form }))}
      pulls={allPulls.slice(0, PULLS_SHOWN)}
      morePulls={allPulls.length > PULLS_SHOWN}
      showQuestions={prefs.oraclePrompts}
      fieldNames={fieldNames}
      // The picture maker is left out when no image tool or picture computer is set up (always in Feathered): lib/ai-ready.ts.
      artHelp={ai.pictures && prefs.artHelp}
      imageToolReady={ai.pictures}
      imageMode={imageMode()}
      artOnDisk={artDir() !== null}
    />
  );
}

export const metadata = { title: "Oracle card" };
