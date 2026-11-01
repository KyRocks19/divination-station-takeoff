import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { parseDate, toISOString } from "@/lib/date";
import { listDecks, listPulls, toId } from "@/lib/oracle";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import { CardLink } from "@/components/ui/Card";

export default async function OraclePullsPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { deck: deckParam } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const decks = await listDecks(session.userId);
  // ?deck= shows one deck's pulls; without it, every pull is listed.
  const deck = decks.find((d) => d.id === toId(deckParam)) ?? null;
  const pulls = await listPulls(session.userId, deck?.id);

  return (
    <Page>
      <BackLink href={deck ? `/oracle?deck=${deck.id}` : "/oracle"}>
        ← {deck?.name ?? "Oracle deck"}
      </BackLink>

      <PageTitle>Past pulls{pulls.length > 0 ? ` (${pulls.length})` : ""}</PageTitle>

      {pulls.length === 0 ? (
        <p className="text-sm text-ink-ghost">No pulls are saved{deck ? " for this deck" : ""}.</p>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {pulls.map((p) => (
            <li key={p.id}>
              <CardLink href={`/oracle/pulls/${p.id}`}>
                <div className="flex justify-between items-start gap-3">
                  <p className="font-medium text-ink-strong break-words min-w-0">
                    {p.cards.map((c) => (c.reversed ? `${c.card_name} (upside down)` : c.card_name)).join(", ")}
                  </p>
                  <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(p.created_at)}>
                    {parseDate(p.created_at).toLocaleDateString()}
                  </time>
                </div>
                {p.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{p.question}</p>}
                {(!deck || p.entry_count > 0) && (
                  <p className="text-xs text-tone-500 mt-1 break-words">
                    {[
                      !deck ? p.deck_name : null,
                      p.entry_count > 0 ? `${p.entry_count} entr${p.entry_count !== 1 ? "ies" : "y"}` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </CardLink>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export const metadata = { title: "Pulls" };
