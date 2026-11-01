import { query, queryOne } from "./db";

// Whether the first-run tour has been seen. The steps themselves are in lib/tour-steps.ts.

/** Whether the person has finished or skipped the tour. */
export async function tourSeen(userId: number): Promise<boolean> {
  const row = await queryOne<{ tour_seen_at: string | null }>("SELECT tour_seen_at FROM users WHERE id = $1", [userId]);
  return !row || row.tour_seen_at !== null;
}

export async function markTourSeen(userId: number): Promise<void> {
  await query("UPDATE users SET tour_seen_at = COALESCE(tour_seen_at, NOW()) WHERE id = $1", [userId]);
}
