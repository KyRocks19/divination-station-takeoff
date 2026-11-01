import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { MAX_REASON, fileReport, type Target } from "@/lib/forum-reports";
import { toId } from "@/lib/oracle";

// Reports a forum post or comment (not one's own). The body is { post_id } or { comment_id }, and an optional reason.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const postId = toId(body.post_id);
  const commentId = toId(body.comment_id);
  if (!postId === !commentId) return Response.json({ error: "Say whether it is a post or a comment." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length > MAX_REASON) return Response.json({ error: `The reason can be ${MAX_REASON} characters at most.` }, { status: 400 });

  const target: Target = postId ? { postId } : { commentId: commentId! };
  const result = await fileReport(session.userId, target, reason || null);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  // The reply never says whether the item was hidden: the person who made the third report is not told they tipped it.
  return Response.json({ ok: true }, { status: 201 });
}
