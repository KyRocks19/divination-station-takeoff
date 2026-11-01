import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { forumViewer } from "@/lib/forum-circles";
import { canModerate } from "@/lib/forum-circles-core";
import { idParam } from "@/lib/own-http";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/forum/[id]/comments/[cid]">
) {
  const { id, cid } = await ctx.params;
  if (idParam(id) === null || idParam(cid) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const comment = await queryOne(
    "SELECT * FROM forum_comments WHERE id = $1 AND post_id = $2",
    [cid, id]
  ) as any;
  if (!comment) return Response.json({ error: "Not found" }, { status: 404 });

  // The author, the owner of the app, or the leader of the circle the post was written in.
  if (comment.user_id !== session.userId) {
    const post = await queryOne("SELECT * FROM forum_posts WHERE id = $1", [id]) as any;
    if (!post || !canModerate(await forumViewer(session.userId, !!session.isAdmin), post)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await query("DELETE FROM forum_comments WHERE id = $1", [cid]);
  return new Response(null, { status: 204 });
}
