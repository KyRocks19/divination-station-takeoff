import type { Metadata } from "next";
import { TAROT_DECK } from "@/lib/cards";

// The page is a client component and cannot set its own title, so its layout does (shown in the tab and read out by screen readers).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = TAROT_DECK.find((c) => c.id === id);
  return { title: card ? card.name : "Card" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
