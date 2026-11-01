// A person's recent searches (migration 071), in the database. Server code only. Every query is for one person (`userId`
// from the session). Nothing is kept unless the person turned the switch on, and nothing here is read by the companion,
// by Patterns or by any model. The rules and shapes are in lib/recent-searches-core.ts.

import { query, queryOne, withTransaction } from "./db";
import { MAX_RECENT, NO_RECENT, recentToKeep, type RecentState } from "./recent-searches-core";

/** Whether the switch is on and the saved searches, newest first. */
export async function getRecent(userId: number): Promise<RecentState> {
  const me = await queryOne<{ remember_searches: number }>("SELECT remember_searches FROM users WHERE id = $1", [userId]);
  if (!me) return NO_RECENT;
  const rows = await query<{ id: number; query: string; searched_at: string }>(
    "SELECT id, query, searched_at FROM recent_searches WHERE user_id = $1 ORDER BY searched_at DESC, id DESC LIMIT $2",
    [userId, MAX_RECENT]
  );
  return {
    on: me.remember_searches === 1,
    items: rows.map((r) => ({ id: r.id, query: r.query, searched_at: new Date(r.searched_at).toISOString() })),
  };
}

/** Turns remembering on or off. Turning it off also deletes what was saved, so "off" leaves nothing behind. */
export async function setRemember(userId: number, on: boolean): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("UPDATE users SET remember_searches = $1 WHERE id = $2", [on ? 1 : 0, userId]);
    if (!on) await client.query("DELETE FROM recent_searches WHERE user_id = $1", [userId]);
  });
}

/**
 * Keeps the words of a search the person acted on. Does nothing when the switch is off or the words are too short. The
 * same words in other capitals are one search, moved to the top; only the newest MAX_RECENT are kept.
 */
export async function recordRecent(userId: number, raw: unknown): Promise<void> {
  const q = recentToKeep(raw);
  if (!q) return;
  await withTransaction(async (client) => {
    // The switch is read inside the transaction, on the person's own row, so a switch-off racing with a search cannot
    // leave a search behind: the off is applied first or this sees it.
    const { rows } = await client.query("SELECT remember_searches FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (rows[0]?.remember_searches !== 1) return;
    await client.query(
      `INSERT INTO recent_searches (user_id, query) VALUES ($1, $2)
       ON CONFLICT (user_id, lower(query)) DO UPDATE SET query = EXCLUDED.query, searched_at = NOW()`,
      [userId, q]
    );
    await client.query(
      `DELETE FROM recent_searches
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM recent_searches WHERE user_id = $1 ORDER BY searched_at DESC, id DESC LIMIT $2
       )`,
      [userId, MAX_RECENT]
    );
  });
}

/** Deletes one saved search of this person's, or all of them when no id is given. */
export async function deleteRecent(userId: number, id?: number): Promise<void> {
  if (id === undefined) await query("DELETE FROM recent_searches WHERE user_id = $1", [userId]);
  else await query("DELETE FROM recent_searches WHERE user_id = $1 AND id = $2", [userId, id]);
}
