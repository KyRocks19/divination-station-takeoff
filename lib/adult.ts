import { query, queryOne } from "./db";

// "I am 18 or older" (owner decision 2026-10-22, migration 092): the whole app is open to every age, and this one confirmation in Settings, off
// until the person ticks it, unlocks the sensitive concepts and the AI features (the companion and the Claude buttons). It is the person's own
// word, not a check of their age.

/** Whether the person has said they are 18 or older. */
export async function adultConfirmed(userId: number): Promise<boolean> {
  const row = await queryOne<{ adult_confirmed: number }>("SELECT adult_confirmed FROM users WHERE id = $1", [userId]);
  return row?.adult_confirmed === 1;
}

/** Saves the person's answer. */
export async function setAdultConfirmed(userId: number, adult: boolean): Promise<void> {
  await query("UPDATE users SET adult_confirmed = $1 WHERE id = $2", [adult ? 1 : 0, userId]);
}

/** What a route answers when a feature needs the confirmation. */
export const NEEDS_ADULT_MESSAGE = "This needs you to confirm in Settings that you are 18 or older.";
