import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCardById } from "@/lib/cards";
import ReviewBoard from "@/components/archetypes/ReviewBoard";
import CardBoard from "@/components/archetypes/CardBoard";
import ReviewGraphs from "@/components/archetypes/ReviewGraphs";
import PieceLinksEditor from "@/components/archetypes/PieceLinksEditor";
import { BackLink, PageTitle } from "@/components/ui/Page";
import { stockPieces } from "@/lib/symbol-edit-core";

export const metadata = { title: "Review the sorting" };

const TABS = [
  { id: "concepts", label: "Concepts" },
  { id: "cards", label: "By card" },
  { id: "graph", label: "Graphs" },
  { id: "pieces", label: "Pieces of the tools" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ view?: string; card?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.view) ? (sp.view as Tab) : "concepts";
  const card = sp.card && getCardById(sp.card) ? sp.card : "major-0";

  return (
    <div className={`${tab === "concepts" || tab === "pieces" ? "max-w-4xl" : "max-w-6xl"} mx-auto px-4 pt-8 pb-12 space-y-6`}>
      <div className="space-y-1">
        <BackLink href="/archetypes">← Archetypes</BackLink>
        <PageTitle>Review the sorting</PageTitle>
      </div>
      {session.isAdmin ? (
        <>
          <nav aria-label="Ways to review" className="flex flex-wrap gap-1.5 border-b border-line pb-4">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={t.id === "concepts" ? "/archetypes/review" : `/archetypes/review?view=${t.id}`}
                aria-current={tab === t.id ? "page" : undefined}
                className={`text-sm px-3 py-1.5 min-h-11 sm:min-h-0 inline-flex items-center rounded-lg transition-colors ${
                  tab === t.id ? "bg-tone-800/60 text-tone-200 font-medium" : "text-ink-muted hover:text-ink-strong bg-surface"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {tab === "concepts" && (
            <>
              <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
                Every tarot concept sits under one first archetype, and can also sit under others. The side says
                whether the concept names the archetype&rsquo;s light side, its shadow side, or either. Under each concept are the cards it
                sits on. Change anything here and it is saved at once. Concepts are shared by every account, so a change
                shows for everyone, and the Patterns counts follow it.
              </p>
              <ReviewBoard />
            </>
          )}

          {tab === "cards" && (
            <>
              <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">
                One card at a time: the archetypes its concepts sit under, its concepts upright and reversed, and every card.
                Drag a concept, or a whole archetype group, onto another card&rsquo;s Upright or Reversed button to send it
                there. Without a mouse, choose concepts with their tick boxes and press the button. Each change is saved at
                once, shared by every account, and written to the admin log.
              </p>
              <CardBoard initialCard={card} />
            </>
          )}

          {tab === "graph" && (
            <>
              <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
                The pictures from the Tarot Library, to see the sorting from further back. They are read again each time this
                tab opens, so they show the changes made in the other tabs.
              </p>
              <ReviewGraphs />
            </>
          )}

          {tab === "pieces" && (
            <>
              <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
                Each rune, ogham letter, die face, coin side, swing and scrying surface reaches one or more archetypes, and each
                link says which side of the archetype (light, shadow or either) it names and what it was drawn from. Change them here; nothing is
                saved until you press Save. These links are shared by every account and Patterns follows them, and each save is
                written to the admin log. A tarot card&rsquo;s archetypes come from its concepts (the other tabs), and a
                pendulum line a person adds has none on purpose.
              </p>
              <PieceLinksEditor pieces={stockPieces()} />
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          Concepts are shared by every account, so only an admin can change how they are sorted. You can see where each one
          sits on its archetype page.
        </p>
      )}
    </div>
  );
}
