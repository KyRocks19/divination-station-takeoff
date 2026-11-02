import { FEATHERED } from "./edition";

// Which AI features this copy can actually run for the person (owner request 2026-11-02): on a copy on a person's own computer (Feathered, Winged,
// Winged in host mode), a feature whose key, model or picture computer is not set up is left out entirely, with no "this is not set up" notice in
// its place. Pure: no database, no network, so the browser, the server and the tests use it. The server works the answer out in lib/ai-ready.ts.

export interface AiReady {
  /** A Claude key that Anthropic accepts: the person's circle's key, or the app's own ANTHROPIC_API_KEY. */
  claude: boolean;
  /** The companion's model: COMPANION_URL on this server, or a studio allowed to take companion requests. */
  companion: boolean;
  /** The picture maker: IMAGE_GEN_URL on this server, or a picture computer (the app's own or the person's circle's). */
  pictures: boolean;
}

export const NO_AI: AiReady = { claude: false, companion: false, pictures: false };
export const ALL_AI: AiReady = { claude: true, companion: true, pictures: true };

/** What the browser may rely on: the Feathered build has no AI at all, whatever the server said. */
export function effectiveAiReady(ready: AiReady | null | undefined, feathered = FEATHERED): AiReady {
  if (feathered || !ready) return NO_AI;
  return { claude: ready.claude === true, companion: ready.companion === true, pictures: ready.pictures === true };
}

export type KeyVerdict = "ok" | "refused" | "unchecked";

/** How long Anthropic's answer about a key is trusted before it is asked again, in milliseconds. */
export function verdictLifetimeMs(verdict: KeyVerdict): number {
  // A key that works is asked about again every few hours; a refused key or no answer (no connection) soon, so a fixed key or a connection
  // that comes back shows the Claude features again without a restart.
  return verdict === "ok" ? 6 * 60 * 60_000 : verdict === "refused" ? 10 * 60_000 : 2 * 60_000;
}

/** The adult-only things this copy has, in words: an AI feature that is not set up here is not named. */
export function adultOnlyThings(ai: { claude: boolean; companion: boolean }): { intro: string; locked: string } {
  const sensitive = "sensitive meanings (words that name abuse, sexual content or violence)";
  const extras = [ai.companion ? "the AI companion" : null, ai.claude ? "the buttons that ask Claude" : null].filter((x): x is string => x !== null);
  const lockedExtras = [ai.companion ? "the companion" : null, ai.claude ? "the Claude buttons" : null].filter((x): x is string => x !== null);
  const after = "They stay locked until you confirm your age here. Your answer is saved in your account and nobody checks it.";
  if (extras.length === 0) {
    return {
      intro: `The app is open to every age. Sensitive meanings (words that name abuse, sexual content or violence) are only for adults. ${after}`,
      locked: "Saved. Sensitive meanings are locked.",
    };
  }
  const count = extras.length === 1 ? "Two" : "Three";
  const list = extras.length === 1 ? `${sensitive} and ${extras[0]}` : `${sensitive}, ${extras[0]}, and ${extras[1]}`;
  const lockedList = lockedExtras.length === 1 ? `Sensitive meanings and ${lockedExtras[0]}` : `Sensitive meanings, ${lockedExtras[0]} and ${lockedExtras[1]}`;
  return { intro: `The app is open to every age. ${count} things are only for adults: ${list}. ${after}`, locked: `Saved. ${lockedList} are locked.` };
}
