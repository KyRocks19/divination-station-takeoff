import { query, queryOne, withTransaction } from "./db";
import { BUNDLE_FORMAT, planImport, type ForumBundle, type ForumImportPlan, type LocalForum } from "./forum-bundle-core";

// The server side of moving a circle's forum between hosts (rules in lib/forum-bundle-core.ts, ids from migration 099). Only the signed-in
// administrator's own circle is read or written, and an import only ever adds. Server code only.

class RolledBack extends Error {}

/** The circle the person belongs to, with its name; null when they are in none. */
export async function circleOf(userId: number): Promise<{ id: number; name: string } | null> {
  return queryOne<{ id: number; name: string }>(
    "SELECT c.id, c.name FROM circle_members cm JOIN circles c ON c.id = cm.circle_id WHERE cm.user_id = $1",
    [userId],
  );
}

/** Whether the error means migration 099 is not on this database yet. */
export function bundleNotReady(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42703" || code === "42P01";
}

/** The circle's visible posts and their comments as a bundle. Hidden (reported) items, attachments and every account detail are left out. */
export async function exportForum(circle: { id: number; name: string }): Promise<ForumBundle> {
  const posts = await query<{ id: number; bundle_uid: string; title: string; body: string; created_at: string; origin_author: string | null; username: string; display_name: string | null }>(
    `SELECT fp.id, fp.bundle_uid, fp.title, fp.body, fp.created_at, fp.origin_author, u.username, u.display_name
       FROM forum_posts fp JOIN users u ON u.id = fp.user_id
      WHERE fp.circle_id = $1 AND fp.hidden_at IS NULL
      ORDER BY fp.created_at ASC, fp.id ASC`,
    [circle.id],
  );
  const ids = posts.map((p) => p.id);
  const comments = ids.length
    ? await query<{ post_id: number; bundle_uid: string; content: string; created_at: string; origin_author: string | null; username: string; display_name: string | null }>(
        `SELECT fc.post_id, fc.bundle_uid, fc.content, fc.created_at, fc.origin_author, u.username, u.display_name
           FROM forum_comments fc JOIN users u ON u.id = fc.user_id
          WHERE fc.post_id = ANY($1::int[]) AND fc.hidden_at IS NULL
          ORDER BY fc.created_at ASC, fc.id ASC`,
        [ids],
      )
    : [];
  const withAttachments = ids.length
    ? await queryOne<{ n: number }>("SELECT COUNT(DISTINCT post_id)::int AS n FROM forum_post_attachments WHERE post_id = ANY($1::int[])", [ids])
    : null;
  // A post that was itself brought in from another host goes on carrying the name it was written under.
  const name = (r: { origin_author: string | null; display_name: string | null; username: string }) => r.origin_author ?? (r.display_name || r.username);
  const user = (r: { origin_author: string | null; username: string }) => (r.origin_author ? `${r.origin_author}`.replace(/\s+/g, "") : r.username);
  const byPost = new Map<number, typeof comments>();
  for (const c of comments) byPost.set(c.post_id, [...(byPost.get(c.post_id) ?? []), c]);
  return {
    format: BUNDLE_FORMAT,
    version: 1,
    exported_at: new Date().toISOString(),
    circle_name: circle.name,
    posts_with_attachments_left_out: withAttachments?.n ?? 0,
    posts: posts.map((p) => ({
      id: p.bundle_uid,
      author: name(p),
      username: user(p),
      title: p.title,
      body: p.body,
      written_at: new Date(p.created_at).toISOString(),
      comments: (byPost.get(p.id) ?? []).map((c) => ({
        id: c.bundle_uid,
        author: name(c),
        username: user(c),
        content: c.content,
        written_at: new Date(c.created_at).toISOString(),
      })),
    })),
  };
}

/**
 * Checks the bundle against this copy and, when `apply` is true, adds what is new. One transaction: all of it or none. Never replaces or deletes.
 * Posts and comments by a person with an account in this circle (same username) are theirs; the rest are kept under `importer` and marked with
 * the name they were written under.
 */
export async function importForum(circleId: number, importer: number, bundle: ForumBundle, leftOut: { posts: number; comments: number }, apply: boolean): Promise<ForumImportPlan> {
  let plan!: ForumImportPlan;
  try {
    await withTransaction(async (client) => {
      const postIds = bundle.posts.map((p) => p.id);
      const commentIds = bundle.posts.flatMap((p) => p.comments.map((c) => c.id));
      const members = await client.query("SELECT u.id, u.username FROM circle_members cm JOIN users u ON u.id = cm.user_id WHERE cm.circle_id = $1", [circleId]);
      const havePosts = postIds.length
        ? await client.query("SELECT id, bundle_uid, circle_id FROM forum_posts WHERE bundle_uid = ANY($1::text[])", [postIds])
        : { rows: [] };
      const haveComments = commentIds.length
        ? await client.query("SELECT bundle_uid FROM forum_comments WHERE bundle_uid = ANY($1::text[])", [commentIds])
        : { rows: [] };
      const local: LocalForum = {
        posts: new Map(havePosts.rows.map((r: { id: number; bundle_uid: string; circle_id: number | null }) => [r.bundle_uid, { id: r.id, inThisCircle: r.circle_id === circleId }])),
        comments: new Set(haveComments.rows.map((r: { bundle_uid: string }) => r.bundle_uid)),
        members: new Map(members.rows.map((r: { id: number; username: string }) => [r.username.toLowerCase(), r.id])),
      };
      plan = planImport(bundle, local, importer, leftOut);
      if (!apply) throw new RolledBack();

      for (const p of plan.newPosts) {
        const row = await client.query(
          "INSERT INTO forum_posts (user_id, circle_id, title, body, created_at, updated_at, bundle_uid, origin_author) VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING id",
          [p.userId, circleId, p.bundle.title, p.bundle.body, p.bundle.written_at, p.bundle.id, p.originAuthor],
        );
        for (const c of p.comments) await insertComment(client, row.rows[0].id, c);
      }
      for (const a of plan.additions) for (const c of a.comments) await insertComment(client, a.postId, c);
    });
  } catch (err) {
    if (!(err instanceof RolledBack)) throw err;
  }
  return plan;
}

async function insertComment(client: { query: (sql: string, params: unknown[]) => Promise<unknown> }, postId: number, c: { bundle: { id: string; content: string; written_at: string }; userId: number; originAuthor: string | null }) {
  await client.query(
    "INSERT INTO forum_comments (post_id, user_id, content, created_at, bundle_uid, origin_author) VALUES ($1, $2, $3, $4, $5, $6)",
    [postId, c.userId, c.bundle.content, c.bundle.written_at, c.bundle.id, c.originAuthor],
  );
}
