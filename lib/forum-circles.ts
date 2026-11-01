import { query, queryOne } from "./db";
import type { ForumViewer } from "./forum-circles-core";

// The server side of the circle-only forum (rules, and the WHERE fragment for a list, in lib/forum-circles-core.ts, migration 074).

/** Who is looking at the forum: their circle, and whether they lead it. */
export async function forumViewer(userId: number, isAdmin: boolean): Promise<ForumViewer> {
  const row = await queryOne<{ circle_id: number; is_leader: boolean }>(
    "SELECT cm.circle_id, (c.owner_id = cm.user_id) AS is_leader FROM circle_members cm JOIN circles c ON c.id = cm.circle_id WHERE cm.user_id = $1",
    [userId],
  );
  return { userId, isAdmin, circleId: row?.circle_id ?? null, isLeader: !!row?.is_leader };
}

/** How many people are in a circle (for the report threshold). */
export async function circleSize(circleId: number): Promise<number> {
  const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM circle_members WHERE circle_id = $1", [circleId]);
  return row?.n ?? 0;
}

/** The circle a forum post was written in (null when it has none), or undefined when there is no such post. */
export async function postCircle(postId: number): Promise<number | null | undefined> {
  const rows = await query<{ circle_id: number | null }>("SELECT circle_id FROM forum_posts WHERE id = $1", [postId]);
  return rows.length === 0 ? undefined : rows[0].circle_id;
}
