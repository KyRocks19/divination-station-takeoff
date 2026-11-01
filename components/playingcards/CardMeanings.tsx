"use client";

import MeaningsPanel from "@/components/MeaningsPanel";
import { getCard } from "@/lib/playingcards-data";

/** A playing card's meaning: the person's own words with every earlier version. The app supplies no text of its own, so there is no tradition button. */
export default function CardMeanings({ cardId }: { cardId: string }) {
  const card = getCard(cardId);
  if (!card) return null;
  return (
    <MeaningsPanel
      cardId={card.meaningId}
      orientation="upright"
      api={`/api/playingcards/meanings/${encodeURIComponent(card.meaningId)}`}
      noun="card"
      hideStock
    />
  );
}
