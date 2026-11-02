"use client";

import { createContext, useContext } from "react";
import { NO_AI, effectiveAiReady, type AiReady } from "@/lib/ai-ready-core";

// Which AI features this copy can run for the person (lib/ai-ready-core.ts), worked out by the root layout on the server. A feature that is not
// ready is left out of the page entirely. Outside the provider (signed out) nothing is ready.

const AiReadyContext = createContext<AiReady>(NO_AI);

export function AiReadyProvider({ ready, children }: { ready: AiReady; children: React.ReactNode }) {
  return <AiReadyContext.Provider value={effectiveAiReady(ready)}>{children}</AiReadyContext.Provider>;
}

export function useAiReady(): AiReady {
  return useContext(AiReadyContext);
}
