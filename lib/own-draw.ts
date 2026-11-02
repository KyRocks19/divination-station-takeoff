import type { PoolClient } from "pg";

/**
 * Readings the person drew with their own deck, coins or stones and recorded here (owner's request, 2026-11-02). Their result was
 * already in front of the person, so the reading opens at once: no opening wait and no "write what you sense first" step
 * (components/reveal/Reveal.tsx, components/useGuess.ts). Tarot keeps the mark in `readings.own_draw` (migration 106); I Ching and
 * geomancy keep it as their own `method = 'entered'`.
 */

/** Marks tarot readings as recorded from the person's own deck. Before migration 106 the mark is simply not kept (a savepoint keeps
 *  the transaction usable), so the reading then opens like one the app drew. */
export async function markOwnDraw(client: PoolClient, readingIds: number[]): Promise<void> {
  if (readingIds.length === 0) return;
  await client.query("SAVEPOINT own_draw");
  try {
    await client.query("UPDATE readings SET own_draw = TRUE WHERE id = ANY($1::int[])", [readingIds]);
    await client.query("RELEASE SAVEPOINT own_draw");
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT own_draw");
    const code = (e as { code?: string }).code;
    if (code !== "42703") throw e;
  }
}
