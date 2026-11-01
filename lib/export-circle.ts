import { query, queryOne } from "./db";
import { inviteStatus } from "./circles-core";
import { shapeCircleExport, EMPTY_CIRCLE_EXPORT, type CircleExport } from "./export-circle-core";

// Reads a person's circle for the data export (see lib/export-circle-core.ts). Every read is for one person and one circle they belong to.

/** The person's circle, or `{ circle: null }` when they are in none. */
export async function collectCircle(userId: number): Promise<CircleExport> {
  const mine = await queryOne<{
    circle_id: number;
    name: string;
    created_at: string;
    owner_id: number;
    claude_member_daily_limit: number;
    claude_daily_limit: number;
    joined_at: string;
    shares_with_host_at: string | null;
  }>(
    `SELECT c.id AS circle_id, c.name, c.created_at, c.owner_id, c.claude_member_daily_limit, c.claude_daily_limit, m.joined_at, m.shares_with_host_at
     FROM circle_members m JOIN circles c ON c.id = m.circle_id WHERE m.user_id = $1`,
    [userId]
  );
  if (!mine) return EMPTY_CIRCLE_EXPORT;
  const isOwner = mine.owner_id === userId;

  const [members, key, computers, usage, invites] = await Promise.all([
    query<{ user_id: number; name: string; joined_at: string }>(
      `SELECT u.id AS user_id, COALESCE(u.display_name, u.username) AS name, m.joined_at
       FROM circle_members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = $1 ORDER BY m.joined_at, u.id`,
      [mine.circle_id]
    ),
    queryOne<{ last4: string; set_at: string }>("SELECT last4, set_at FROM circle_claude_keys WHERE circle_id = $1", [mine.circle_id]),
    query<{ name: string; created_at: string; last_used_at: string | null }>(
      "SELECT name, created_at, last_used_at FROM worker_tokens WHERE circle_id = $1 AND revoked_at IS NULL ORDER BY created_at, id",
      [mine.circle_id]
    ),
    query<{ day: string; calls: number }>(
      "SELECT to_char(day, 'YYYY-MM-DD') AS day, calls FROM circle_ai_usage WHERE circle_id = $1 AND user_id = $2 AND calls > 0 ORDER BY day",
      [mine.circle_id, userId]
    ),
    isOwner
      ? query<{ note: string | null; created_at: string; expires_at: string; used_at: string | null; revoked_at: string | null; used_by_name: string | null }>(
          `SELECT i.note, i.created_at, i.expires_at, i.used_at, i.revoked_at, COALESCE(u.display_name, u.username) AS used_by_name
           FROM circle_invites i LEFT JOIN users u ON u.id = i.used_by WHERE i.circle_id = $1 ORDER BY i.created_at, i.id`,
          [mine.circle_id]
        )
      : Promise.resolve([]),
  ]);

  return shapeCircleExport({
    circle: { name: mine.name, created_at: mine.created_at, owner_id: mine.owner_id, claude_member_daily_limit: mine.claude_member_daily_limit, claude_daily_limit: mine.claude_daily_limit },
    me: { user_id: userId, joined_at: mine.joined_at, shares_with_host_at: mine.shares_with_host_at },
    members,
    has_key: !!key,
    has_computer: isOwner ? computers.length > 0 : await hasComputer(mine.circle_id),
    key: isOwner ? key : null,
    computers: isOwner ? computers : [],
    usage,
    invites: invites.map((i) => ({
      note: i.note,
      created_at: i.created_at,
      expires_at: i.expires_at,
      status: inviteStatus(i),
      used_by_name: i.used_by_name,
    })),
  });
}

async function hasComputer(circleId: number): Promise<boolean> {
  const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM worker_tokens WHERE circle_id = $1 AND revoked_at IS NULL AND can_pictures = 1", [circleId]);
  return (row?.n ?? 0) > 0;
}
