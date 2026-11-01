import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tooLong } from "@/lib/limits";
import { maskHidden, maySeeHidden } from "@/lib/forum-reports";
import { hydrateAttachment } from "@/lib/forum-attachments";
import { forumViewer } from "@/lib/forum-circles";
import { canModerate, canSeePost } from "@/lib/forum-circles-core";
import { idParam, jsonBody } from "@/lib/own-http";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/forum/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });

  const post = await queryOne(`
    SELECT fp.*, u.username, u.display_name
    FROM forum_posts fp
    JOIN users u ON u.id = fp.user_id
    WHERE fp.id = $1
  `, [id]) as any;

  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  // The forum belongs to a circle (migration 074): a post outside the person's circle is not there for them.
  if (!canSeePost(await forumViewer(session.userId, !!session.isAdmin), post)) return Response.json({ error: "Not found" }, { status: 404 });
  // Reported by enough different people (HIDE_AFTER): only its author and the owner can read it until the owner has looked (migration 054).
  if (post.hidden_at && !maySeeHidden(post.user_id, session.userId, !!session.isAdmin)) return Response.json({ error: "Not found" }, { status: 404 });

  const attRows = await query("SELECT * FROM forum_post_attachments WHERE post_id = $1 ORDER BY id ASC", [id]) as any[];
  const attachments = (await Promise.all(attRows.map(hydrateAttachment))).filter(Boolean);

  const comments = await query(`
    SELECT fc.*, u.username, u.display_name
    FROM forum_comments fc
    JOIN users u ON u.id = fc.user_id
    WHERE fc.post_id = $1
    ORDER BY fc.created_at ASC
  `, [id]);

  return Response.json({
    ...post,
    author: { username: post.username, display_name: post.display_name },
    attachments,
    comments: maskHidden(comments as any[], session.userId, !!session.isAdmin),
  });
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/forum/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });

  const post = await queryOne("SELECT * FROM forum_posts WHERE id = $1", [id]) as any;
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  // Only the author changes the words. The owner of the app and a circle leader can remove a post (DELETE) but never rewrite it (decided 2026-10-22).
  if (post.user_id !== session.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { title, body } = sent;
  if (typeof title !== "string" || !title.trim()) return Response.json({ error: "title is required" }, { status: 400 });
  if (typeof body !== "string" || !body.trim()) return Response.json({ error: "body is required" }, { status: 400 });
  if (tooLong(title, 200) || tooLong(body, 10000)) {
    return Response.json({ error: "That post is too long (title 200 characters, text 10,000)" }, { status: 400 });
  }

  await query(
    "UPDATE forum_posts SET title = $1, body = $2, updated_at = NOW() WHERE id = $3",
    [title.trim(), body.trim(), id]
  );

  return Response.json({ id: Number(id) });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/forum/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });

  const post = await queryOne("SELECT * FROM forum_posts WHERE id = $1", [id]) as any;
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  // The author, the owner of the app, or the leader of the circle the post was written in.
  if (post.user_id !== session.userId && !canModerate(await forumViewer(session.userId, !!session.isAdmin), post)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await query("DELETE FROM forum_posts WHERE id = $1", [id]);
  return new Response(null, { status: 204 });
}
