"use client";

import { createContext, useContext } from "react";
import type { DivinationKind } from "@/lib/divination-kinds";

// The person's saved choice of tools, handed down from the root layout so that screens which run in the
// browser can follow it. Null means every tool. The layout reads it again whenever the page refreshes,
// which is what a star in the navigation does after a change.
const ChosenToolsContext = createContext<DivinationKind[] | null>(null);

export function ChosenToolsProvider({
  tools,
  children,
}: {
  tools: DivinationKind[] | null;
  children: React.ReactNode;
}) {
  return <ChosenToolsContext.Provider value={tools}>{children}</ChosenToolsContext.Provider>;
}

/** The tools the person chose to see first. Null means every tool. */
export function useChosenTools(): DivinationKind[] | null {
  return useContext(ChosenToolsContext);
}
