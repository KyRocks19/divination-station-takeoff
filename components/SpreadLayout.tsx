"use client";

import CelticCrossViewBox from "./CelticCrossViewBox";
import SpreadSVG from "./SpreadSVG";
import LayoutBoard, { type BoardCard } from "./LayoutBoard";

interface DrawnCard {
  position: string;
  card_id: string;
  card_name: string;
  reversed: boolean;
  color?: string;
  /** Where the layout placed this card on a board, when it had a board. */
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
}

interface Props {
  cards: DrawnCard[];
  spreadName: string;
  openIndex: number | null;
  onToggle: (i: number) => void;
}

export default function SpreadLayout({ cards, spreadName, openIndex, onToggle }: Props) {
  // A reading made with a layout that had a board carries each card's place; use it.
  const onBoard = cards.length > 0 && cards.every((c) => typeof c.x === "number" && typeof c.y === "number");
  // Readings made before layouts have no places; a Celtic Cross among them is still drawn on its own board.
  const isCeltic = spreadName.toLowerCase().includes("celtic cross") && cards.length === 10;

  return (
    <div>
      {onBoard ? (
        <LayoutBoard cards={cards as BoardCard[]} layoutName={spreadName} openIndex={openIndex} onToggle={onToggle} />
      ) : isCeltic ? (
        <CelticCrossViewBox
          cards={cards}
          openIndex={openIndex}
          onToggle={onToggle}
        />
      ) : (
        <SpreadSVG
          cards={cards}
          spreadName={spreadName}
          openIndex={openIndex}
          onToggle={onToggle}
        />
      )}
    </div>
  );
}
