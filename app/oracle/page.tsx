import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { countPulls, listCards, listDecks, listFieldNames, toId, FIRST_DECK_NAME } from "@/lib/oracle";
import AddCardForm from "@/components/oracle/AddCardForm";
import BulkAddForm from "@/components/oracle/BulkAddForm";
import PutBack from "@/components/oracle/PutBack";
import { bagWords } from "@/lib/lots-core";
import CardList from "@/components/oracle/CardList";
import DeckFieldNames from "@/components/oracle/DeckFieldNames";
import DeckSettings from "@/components/oracle/DeckSettings";
import { PageTitle } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";
import { formWords } from "@/lib/oracle-forms";
import SourcesLine from "@/components/sources/SourcesLine";

export default async function OraclePage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { deck: deckParam } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [decks, prefs, fieldNames] = await Promise.all([
    listDecks(session.userId),
    getPrefs(session.userId),
    listFieldNames(session.userId),
  ]);
  // ?deck= picks a deck; otherwise the first one. A person with no cards has no deck until they add a card.
  const deck = decks.find((d) => d.id === toId(deckParam)) ?? decks[0] ?? null;
  const [cards, pullCount] = deck
    ? await Promise.all([listCards(session.userId, deck.id), countPulls(session.userId, deck.id)])
    : [[], 0];

  const w = formWords(deck?.form);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-16 space-y-8">
      <header className="space-y-2">
        <PageTitle>{deck?.name ?? FIRST_DECK_NAME}</PageTitle>
        {deck?.description && (
          <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap max-w-2xl">{deck.description}</p>
        )}
        {prefs.scaffolding === "more" && (
          <p className="text-sm text-ink-faint leading-relaxed max-w-2xl">{w.intro}</p>
        )}
      </header>

      {decks.length > 1 && deck && (
        <nav aria-label="Your sets" className="flex flex-wrap gap-2">
          {decks.map((d) => (
            <Link
              key={d.id}
              href={`/oracle?deck=${d.id}`}
              aria-current={d.id === deck.id ? "page" : undefined}
              className={`text-sm px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg border transition-colors ${
                d.id === deck.id
                  ? "bg-tone-700 border-tone-600 text-white"
                  : "border-line-strong text-ink-muted hover:border-line-hover"
              }`}
            >
              {d.name} <span className="text-xs">({d.card_count})</span>
            </Link>
          ))}
        </nav>
      )}

      {deck && (cards.length > 0 || pullCount > 0) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {cards.some((c) => c.resting === 0) ? (
            <ButtonLink href={`/oracle/pulls/new?deck=${deck.id}`} variant="primary">
              Pull some {w.many}
            </ButtonLink>
          ) : cards.length > 0 && (
            <p className="text-sm text-ink-faint">Every {w.one} in this {w.group} is resting, so there is no {w.one} to pull.</p>
          )}
          {pullCount > 0 && (
            <Link
              href={`/oracle/pulls?deck=${deck.id}`}
              className="text-sm text-accent-ink hover:text-accent-ink-hover transition-colors"
            >
              Past pulls ({pullCount})
            </Link>
          )}
        </div>
      )}

      <p className="text-sm">
        <Link href="/oracle/gallery" className="text-accent-ink hover:text-accent-ink-hover transition-colors">
          Your picture gallery
        </Link>
      </p>

      {deck && cards.length > 0 && (
        <p className="text-sm text-ink-muted">{bagWords(cards.filter((c) => c.resting === 0).length, cards.filter((c) => c.resting === 1).length, w.group)}.</p>
      )}
      {deck && cards.some((c) => c.resting === 1) && <PutBack deckId={deck.id} resting={cards.filter((c) => c.resting === 1).length} w={w} />}

      <AddCardForm deckId={deck?.id ?? null} form={deck?.form} showQuestion={prefs.oraclePrompts} />
      {deck && <BulkAddForm deckId={deck.id} form={deck.form} />}

      <CardList
        key={`cards-${deck?.id ?? 0}`}
        deckId={deck?.id ?? 0}
        form={deck?.form}
        cards={cards.map((c) => ({
          id: c.id,
          name: c.name,
          origin: c.origin,
          meaningCount: c.meaning_count,
          artVersion: c.art_version,
          artAlt: c.art_alt,
          resting: c.resting === 1,
        }))}
      />

      {deck && <DeckFieldNames initialNames={fieldNames} thing={w.one} />}

      {deck && (
        <DeckSettings
          key={`settings-${deck.id}`}
          deckId={deck.id}
          name={deck.name}
          description={deck.description}
          reversals={deck.reversals === 1}
          reversalChance={deck.reversal_chance}
          form={deck.form}
          cardCount={deck.card_count}
        />
      )}
      <SourcesLine tool="oracle" />
    </div>
  );
}

export const metadata = { title: "Oracle Deck" };
