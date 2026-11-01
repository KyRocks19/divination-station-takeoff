import { queryOne } from "./db";

// What the person sensed first on a reading, for the companion: only a written guess they ticked "let the companion read" on that one reading
// (owner decision 2026-10-22, migration 092). Never a set-aside one, and never without the tick.

export interface SensedFirst {
  /** YYYY-MM-DD the words were sealed. */
  when: string;
  text: string;
}

export async function sensedFirstFor(userId: number, divinationId: number): Promise<SensedFirst | null> {
  const row = await queryOne<{ guess: string; sealed_at: string | Date }>(
    "SELECT guess, sealed_at FROM reading_guesses WHERE divination_id = $1 AND user_id = $2 AND NOT skipped AND companion_ok",
    [divinationId, userId]
  );
  return row ? { when: new Date(row.sealed_at).toISOString().slice(0, 10), text: row.guess } : null;
}
