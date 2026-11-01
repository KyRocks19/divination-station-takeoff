import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { revokeInvite } from "@/lib/invites";
import { logAdminAction } from "@/lib/admin-log";

// Revokes an unused code, so it no longer works.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await revokeInvite(id))) return Response.json({ error: "That code is already used, revoked, or not there." }, { status: 404 });
  await logAdminAction(session, "invite_revoked", { detail: `code ${id}` });
  return Response.json({ ok: true });
}
