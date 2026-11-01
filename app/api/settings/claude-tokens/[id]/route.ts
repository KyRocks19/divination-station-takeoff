import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { revokeClaudeToken } from "@/lib/claude-tokens";

// Revokes one of the person's own tokens: it stops working at once.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await revokeClaudeToken(session.userId, id))) return Response.json({ error: "That token is already revoked, or not yours." }, { status: 404 });
  return Response.json({ ok: true });
}
