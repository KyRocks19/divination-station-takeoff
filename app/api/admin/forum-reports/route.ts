import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { resolveReports, type Target } from "@/lib/forum-reports";
import { toId } from "@/lib/oracle";
import { logAdminAction } from "@/lib/admin-log";
import { forumViewer } from "@/lib/forum-circles";
import { canModerate } from "@/lib/forum-circles-core";
import { queryOne } from "@/lib/db";

// The decision on a reported post or comment, by the owner of the app or the leader of the circle it was written in: { action: "keep" | "delete", post_id | comment_id }.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== "keep" && body.action !== "delete") return Response.json({ error: "action must be keep or delete" }, { status: 400 });
  const postId = toId(body.post_id);
  const commentId = toId(body.comment_id);
  if (!postId === !commentId) return Response.json({ error: "Say whether it is a post or a comment." }, { status: 400 });
  const target: Target = postId ? { postId } : { commentId: commentId! };
  if (!session.isAdmin) {
    const item = await queryOne<{ post: { user_id: number; circle_id?: number | null } }>(
      postId
        ? "SELECT json_build_object('user_id', fp.user_id, 'circle_id', fp.circle_id) AS post FROM forum_posts fp WHERE fp.id = $1"
        : "SELECT json_build_object('user_id', fp.user_id, 'circle_id', fp.circle_id) AS post FROM forum_comments fc JOIN forum_posts fp ON fp.id = fc.post_id WHERE fc.id = $1",
      [postId ?? commentId],
    );
    if (!item || !canModerate(await forumViewer(session.userId, false), item.post)) return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await resolveReports(target, body.action))) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.isAdmin) await logAdminAction(session, body.action === "keep" ? "report_kept" : "report_deleted", { detail: postId ? `post #${postId}` : `comment #${commentId}` });
  return Response.json({ ok: true });
}
