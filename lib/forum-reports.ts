import { query, queryOne, withTransaction } from "./db";
import { circleSize, forumViewer } from "./forum-circles";
import { canSeePost, hideThreshold } from "./forum-circles-core";

// Reports on forum posts and comments. HIDE_AFTER different people reporting the same thing hides it from everyone but its author and the owner,
// until the owner keeps it up or deletes it. Nothing is deleted automatically.

/** How many different people must have an open report on something before it is hidden (the user chose 5 on 2026-10-14, for about 50 friends). */
export const HIDE_AFTER = 5;
export const MAX_REASON = 500;
/** The most reports one person can make in a day, so a slip or a grudge cannot flood the owner's list. */
export const MAX_REPORTS_PER_DAY = 20;

export const HIDDEN_COMMENT_NOTE = "This comment is hidden while the owner looks at it.";

/** `threshold` is HIDE_AFTER unless the item sits in a circle, where it follows the circle's size (hideThreshold in forum-circles-core.ts). */
export const shouldHide = (distinctOpenReporters: number, threshold = HIDE_AFTER) => distinctOpenReporters >= threshold;

/** SQL for "this person may see this row": it is not hidden, or it is theirs, or they are the owner. Parameters are given by their $n names. */
export const visibleSql = (alias: string, userParam: string, adminParam: string) =>
  `(${alias}.hidden_at IS NULL OR ${alias}.user_id = ${userParam} OR ${adminParam}::boolean)`;

/** Whether this person may see a hidden item (its author, or the owner). */
export const maySeeHidden =(ownerId: number, meId: number | null, isAdmin: boolean) => isAdmin || (meId !== null && meId === ownerId);

type Maskable = { user_id: number; content: string; hidden_at?: string | null };

/** Comments as this person should receive them: a hidden comment shows only a plain note to anyone but its author and the owner. */
export function maskHidden<T extends Maskable>(rows: T[], meId: number | null, isAdmin: boolean): (T & { hidden: boolean })[] {
  return rows.map((r) => {
    if (!r.hidden_at) return { ...r, hidden: false };
    return maySeeHidden(r.user_id, meId, isAdmin) ? { ...r, hidden: true } : { ...r, content: HIDDEN_COMMENT_NOTE, hidden: true };
  });
}

export type Target = { postId: number; commentId?: undefined } | { commentId: number; postId?: undefined };

export type ReportResult =
  | { ok: true; hidden: boolean }
  | { ok: false; status: 404 | 400 | 409 | 429; error: string };

/** Files a report for the signed-in person. Hides the item when enough different people have reported it. */
export async function fileReport(reporterId: number, target: Target, reason: string | null): Promise<ReportResult> {
  const table = target.postId !== undefined ? "forum_posts" : "forum_comments";
  const column = target.postId !== undefined ? "post_id" : "comment_id";
  const id = target.postId ?? target.commentId!;

  const item = await queryOne<{ user_id: number; post: { user_id: number; circle_id?: number | null } }>(
    target.postId !== undefined
      ? "SELECT fp.user_id, json_build_object('user_id', fp.user_id, 'circle_id', fp.circle_id) AS post FROM forum_posts fp WHERE fp.id = $1"
      : "SELECT fc.user_id, json_build_object('user_id', fp.user_id, 'circle_id', fp.circle_id) AS post FROM forum_comments fc JOIN forum_posts fp ON fp.id = fc.post_id WHERE fc.id = $1",
    [id],
  );
  // Something outside the reporter's circle is not there for them (migration 074).
  if (!item || !canSeePost(await forumViewer(reporterId, false), item.post)) return { ok: false, status: 404, error: "That is not there any more." };
  // In a circle the number of reporters that hides something follows the circle's size, so a small circle can reach it.
  const circleId = item.post.circle_id ?? null;
  const threshold = circleId ? hideThreshold(await circleSize(circleId)) : HIDE_AFTER;
  if (item.user_id === reporterId) return { ok: false, status: 400, error: "You cannot report your own writing. You can edit or delete it instead." };

  const today = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM forum_reports WHERE reporter_id = $1 AND created_at > NOW() - INTERVAL '1 day'", [reporterId]);
  if ((today?.n ?? 0) >= MAX_REPORTS_PER_DAY) return { ok: false, status: 429, error: "You have made a lot of reports today. Please try again tomorrow." };

  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO forum_reports (reporter_id, ${column}, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
      [reporterId, id, reason]
    );
    if (inserted.rowCount === 0) return { ok: false as const, status: 409 as const, error: "You have already reported this." };
    const count = await client.query<{ n: number }>(
      `SELECT COUNT(DISTINCT reporter_id)::int AS n FROM forum_reports WHERE ${column} = $1 AND resolved_at IS NULL`,
      [id]
    );
    let hidden = false;
    if (shouldHide(count.rows[0].n, threshold)) {
      await client.query(`UPDATE ${table} SET hidden_at = COALESCE(hidden_at, NOW()) WHERE id = $1`, [id]);
      hidden = true;
    }
    return { ok: true as const, hidden };
  });
}

/** The owner's decision on a reported post or comment: keep it up (reports resolved, shown again) or delete it. */
export async function resolveReports(target: Target, action: "keep" | "delete"): Promise<boolean> {
  const table = target.postId !== undefined ? "forum_posts" : "forum_comments";
  const column = target.postId !== undefined ? "post_id" : "comment_id";
  const id = target.postId ?? target.commentId!;
  if (action === "delete") {
    const row = await queryOne<{ id: number }>(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
    return !!row;
  }
  const row = await queryOne<{ id: number }>(`UPDATE ${table} SET hidden_at = NULL WHERE id = $1 RETURNING id`, [id]);
  if (!row) return false;
  await query(`UPDATE forum_reports SET resolved_at = NOW() WHERE ${column} = $1 AND resolved_at IS NULL`, [id]);
  return true;
}

export interface QueueItem {
  kind: "post" | "comment";
  id: number;
  post_id: number;
  text: string;
  author: string;
  hidden: boolean;
  reporters: number;
  reasons: string[];
  first_reported: string;
}

/** Everything with an open report, most reported first. */
export async function reportQueue(circleId?: number): Promise<QueueItem[]> {
  const scope = circleId !== undefined ? " AND fp.circle_id = $1" : "";
  const params = circleId !== undefined ? [circleId] : [];
  const posts = await query<{ id: number; title: string; body: string; author: string; hidden_at: string | null; reporters: number; reasons: (string | null)[]; first_reported: string }>(
    `SELECT fp.id, fp.title, fp.body, COALESCE(u.display_name, u.username) AS author, fp.hidden_at,
            COUNT(DISTINCT r.reporter_id)::int AS reporters, array_agg(r.reason ORDER BY r.created_at) AS reasons, MIN(r.created_at) AS first_reported
     FROM forum_reports r JOIN forum_posts fp ON fp.id = r.post_id JOIN users u ON u.id = fp.user_id
     WHERE r.resolved_at IS NULL${scope} GROUP BY fp.id, u.display_name, u.username`,
    params,
  );
  const comments = await query<{ id: number; post_id: number; content: string; author: string; hidden_at: string | null; reporters: number; reasons: (string | null)[]; first_reported: string }>(
    `SELECT fc.id, fc.post_id, fc.content, COALESCE(u.display_name, u.username) AS author, fc.hidden_at,
            COUNT(DISTINCT r.reporter_id)::int AS reporters, array_agg(r.reason ORDER BY r.created_at) AS reasons, MIN(r.created_at) AS first_reported
     FROM forum_reports r JOIN forum_comments fc ON fc.id = r.comment_id JOIN forum_posts fp ON fp.id = fc.post_id JOIN users u ON u.id = fc.user_id
     WHERE r.resolved_at IS NULL${scope} GROUP BY fc.id, u.display_name, u.username`,
    params,
  );
  const items: QueueItem[] = [
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, post_id: p.id, text: `${p.title}\n\n${p.body}`, author: p.author, hidden: !!p.hidden_at, reporters: p.reporters, reasons: p.reasons.filter((x): x is string => !!x), first_reported: p.first_reported })),
    ...comments.map((c) => ({ kind: "comment" as const, id: c.id, post_id: c.post_id, text: c.content, author: c.author, hidden: !!c.hidden_at, reporters: c.reporters, reasons: c.reasons.filter((x): x is string => !!x), first_reported: c.first_reported })),
  ];
  return items.sort((a, b) => b.reporters - a.reporters || a.first_reported.localeCompare(b.first_reported));
}

/** How many things have an open report (for the owner's link; a circle's leader passes their circle). */
export async function openReportCount(circleId?: number): Promise<number> {
  const row = circleId === undefined
    ? await queryOne<{ n: number }>("SELECT (COUNT(DISTINCT post_id) + COUNT(DISTINCT comment_id))::int AS n FROM forum_reports WHERE resolved_at IS NULL")
    : await queryOne<{ n: number }>(
        `SELECT (COUNT(DISTINCT r.post_id) + COUNT(DISTINCT r.comment_id))::int AS n
         FROM forum_reports r
         LEFT JOIN forum_posts fp ON fp.id = r.post_id
         LEFT JOIN forum_comments fc ON fc.id = r.comment_id
         LEFT JOIN forum_posts fp2 ON fp2.id = fc.post_id
         WHERE r.resolved_at IS NULL AND COALESCE(fp.circle_id, fp2.circle_id) = $1`,
        [circleId],
      );
  return row?.n ?? 0;
}
