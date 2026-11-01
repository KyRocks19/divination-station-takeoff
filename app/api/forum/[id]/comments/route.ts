import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tooLong } from "@/lib/limits";
import { maskHidden, maySeeHidden } from "@/lib/forum-reports";
import { forumViewer } from "@/lib/forum-circles";
import { canSeePost } from "@/lib/forum-circles-core";
import { idParam, jsonBody } from "@/lib/own-http";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/forum/[id]/comments">) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const post = await queryOne<{ id: number; user_id: number; circle_id?: number | null; hidden_at?: string | null }>("SELECT * FROM forum_posts WHERE id = $1", [id]);
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canSeePost(await forumViewer(session.userId, !!session.isAdmin), post)) return Response.json({ error: "Not found" }, { status: 404 });
  if (post.hidden_at && !maySeeHidden(post.user_id, session.userId, !!session.isAdmin)) return Response.json({ error: "Not found" }, { status: 404 });

  const comments = await query<{ user_id: number; content: string; hidden_at?: string | null }>(`
    SELECT fc.*, u.username, u.display_name
    FROM forum_comments fc
    JOIN users u ON u.id = fc.user_id
    WHERE fc.post_id = $1
    ORDER BY fc.created_at ASC
  `, [id]);

  return Response.json(maskHidden(comments, session.userId, !!session.isAdmin));
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/forum/[id]/comments">) {
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const post = await queryOne<{ id: number; user_id: number; circle_id?: number | null; hidden_at?: string | null }>("SELECT * FROM forum_posts WHERE id = $1", [id]);
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canSeePost(await forumViewer(session.userId, !!session.isAdmin), post)) return Response.json({ error: "Not found" }, { status: 404 });
  if (post.hidden_at && !maySeeHidden(post.user_id, session.userId, !!session.isAdmin)) return Response.json({ error: "Not found" }, { status: 404 });

  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { content } = sent;
  if (!content?.trim()) return Response.json({ error: "content is required" }, { status: 400 });
  if (tooLong(content, 5000)) return Response.json({ error: "That comment is too long (5,000 characters)" }, { status: 400 });

  const row = await queryOne<{ id: number }>(
    "INSERT INTO forum_comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING id",
    [id, session.userId, content.trim()]
  );

  const comment = await queryOne(`
    SELECT fc.*, u.username, u.display_name
    FROM forum_comments fc
    JOIN users u ON u.id = fc.user_id
    WHERE fc.id = $1
  `, [row!.id]);

  return Response.json(comment, { status: 201 });
}
