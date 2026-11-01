import { getCard, suitOf } from "@/lib/playingcards-data";

/** One playing card drawn as a plain face: its rank and suit mark in two corners and the mark in the middle. The card's written name is always beside it. */
export default function CardFace({ cardId, className = "w-20 h-28" }: { cardId: string; className?: string }) {
  const card = getCard(cardId);
  if (!card) return null;
  const suit = suitOf(card);
  const ink = suit.red ? "text-danger-ink" : "text-ink-strong";
  return (
    <div className={`${className} ${ink} bg-surface border border-line rounded-card relative flex-shrink-0 select-none`} aria-hidden="true">
      <span className="absolute top-1 left-1.5 text-sm font-bold leading-none">
        {card.rank}
        <br />
        {suit.symbol}
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-4xl">{suit.symbol}</span>
      <span className="absolute bottom-1 right-1.5 text-sm font-bold leading-none rotate-180">
        {card.rank}
        <br />
        {suit.symbol}
      </span>
    </div>
  );
}
