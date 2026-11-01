"use client";

import { useState } from "react";
import SpreadLayout from "@/components/SpreadLayout";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
}

interface Props {
  cards: DrawnCard[];
  spreadName: string;
}

export default function ForumSpreadView({ cards, spreadName }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SpreadLayout
      cards={cards}
      spreadName={spreadName}
      openIndex={openIndex}
      onToggle={(i) => setOpenIndex(openIndex === i ? null : i)}
    />
  );
}
