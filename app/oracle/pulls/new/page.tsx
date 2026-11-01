import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listCards, listDecks, toId } from "@/lib/oracle";
import PullForm from "@/components/oracle/PullForm";
import PutBack from "@/components/oracle/PutBack";
import { listLayouts } from "@/lib/layouts";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import { formWords } from "@/lib/oracle-forms";

export default async function NewPullPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { deck: deckParam } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [decks, prefs, layouts] = await Promise.all([
    listDecks(session.userId),
    getPrefs(session.userId),
    listLayouts(session.userId),
  ]);
  const deck = decks.find((d) => d.id === toId(deckParam)) ?? decks[0] ?? null;
  const cards = deck ? await listCards(session.userId, deck.id) : [];
  // Resting cards stay in the deck but are left out of pulls.
  const resting = cards.filter((c) => c.resting === 1).length;
  const waking = cards.length - resting;
  const w = formWords(deck?.form);

  return (
    <Page>
      <BackLink href={deck ? `/oracle?deck=${deck.id}` : "/oracle"}>
        ← {deck?.name ?? "Oracle deck"}
      </BackLink>

      <PageTitle>Pull some {w.many}</PageTitle>

      {deck && waking > 0 ? (
        <>
          <p className="text-sm text-ink-muted break-words">
            From {deck.name}, {waking} {waking !== 1 ? w.many : w.one}
            {resting > 0 ? ` (${resting} more ${resting !== 1 ? "are" : "is"} resting)` : ""}.
          </p>
          <PullForm deckId={deck.id} form={deck.form} hints={prefs.scaffolding === "more"} layouts={layouts} waking={waking} resting={resting} />
        </>
      ) : cards.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-faint">
            Every {w.one} in this {w.group} is resting, so there is no {w.one} to pull. Put them back, or open {w.a} and wake it.
          </p>
          {deck && <PutBack deckId={deck.id} resting={resting} w={w} />}
        </div>
      ) : (
        <p className="text-sm text-ink-faint">This {w.group} has no {w.many} to pull. Add {w.a} first.</p>
      )}
    </Page>
  );
}

export const metadata = { title: "New pull" };
