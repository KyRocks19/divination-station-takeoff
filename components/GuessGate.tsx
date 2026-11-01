"use client";

import { createContext, useContext } from "react";
import { useGuess } from "@/components/useGuess";

// The part of "write what you sense first" that the meaning buttons of a reading need: whether the meanings are still closed. A reading's view
// wraps itself in the provider once; each "Your words" or "Traditional meanings" button below it asks `useMeaningsHeld()` and stays out of the
// page until the person has written their words or set the step aside (the card that asks is GuessFirst).

const HeldContext = createContext(false);

export function GuessProvider({ divinationId, children }: { divinationId: number | null | undefined; children: React.ReactNode }) {
  const { held } = useGuess(divinationId);
  return <HeldContext.Provider value={held}>{children}</HeldContext.Provider>;
}

/** True while this reading's meanings should stay closed. False outside a provider, so a button used elsewhere is unaffected. */
export function useMeaningsHeld(): boolean {
  return useContext(HeldContext);
}
