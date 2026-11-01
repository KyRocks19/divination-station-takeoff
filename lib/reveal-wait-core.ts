// How long the opening of a new reading lasts: the one wait, with the question shown and the cards shuffling (or the tea brewing,
// the pendulum swinging), before the reading is shown (owner's request, 2026-11-01: "hold your question" and "shuffle the deck" are one
// step, from 30 seconds to five minutes). Kept in this browser only, like the pendulum's speed, so it needs no migration. No imports.

export const REVEAL_WAIT_KEY = "ds-reveal-wait";

/** The lengths a person can choose, in seconds. */
export const REVEAL_WAIT_CHOICES: { seconds: number; label: string }[] = [
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 240, label: "4 minutes" },
  { seconds: 300, label: "5 minutes" },
];

export const DEFAULT_REVEAL_WAIT = 30;

/** The stored choice, in seconds; anything missing or unknown is the default. */
export function parseRevealWait(raw: string | null | undefined): number {
  const n = Number(raw);
  return REVEAL_WAIT_CHOICES.some((c) => c.seconds === n) ? n : DEFAULT_REVEAL_WAIT;
}
