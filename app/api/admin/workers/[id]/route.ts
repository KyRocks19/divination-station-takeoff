import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { revokeWorkerToken } from "@/lib/worker-tokens";
import { logAdminAction } from "@/lib/admin-log";

// Revokes a picture computer's token: it stops working at once, and what that computer was making goes back in the queue.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await revokeWorkerToken(id))) return Response.json({ error: "That token is already revoked, or not there." }, { status: 404 });
  console.info(`[worker-api] ${session.username} revoked worker token ${id}`);
  await logAdminAction(session, "worker_token_revoked", { detail: `token ${id}` });
  return Response.json({ ok: true });
}
