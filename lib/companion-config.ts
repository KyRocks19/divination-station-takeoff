// Which model the companion uses, and how it is asked. Chosen after the 2026-10-14 bake-off (docs/archive/companion-bakeoff.md): Gemma 4 followed
// the companion's rules most cleanly and varied its questions most. It runs on the owner's PC through KoboldCpp's router mode, where the
// model is named by the config file in the admin folder. Another model can be tried by setting COMPANION_MODEL, without touching code.

export const DEFAULT_COMPANION_MODEL = "Gemma4-v2-Q4plain.kcpps";

export function companionModel(env: Record<string, string | undefined> = process.env): string {
  return env.COMPANION_MODEL?.trim() || DEFAULT_COMPANION_MODEL;
}

export const COMPANION_SETTINGS = {
  /** The questions: a few short lines, never more than this many tokens. */
  maxTokens: 400,
  temperature: 0.7,
  /** The risk check answers with one word, and should answer the same way each time. */
  riskCheckMaxTokens: 8,
  riskCheckTemperature: 0,
} as const;
