import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { logAdminAction } from "@/lib/admin-log";
import { MAX_NOTE, MAX_OPEN_INVITES, createInvite, listInvites } from "@/lib/invites";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return null;
  return session;
}

// The owner's list of invite codes (never the codes themselves: only a hash is kept).
export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(await listInvites());
}

// Makes one single-use code. The reply holds the readable code; it cannot be shown again.
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_NOTE) return Response.json({ error: `The note can be ${MAX_NOTE} characters at most` }, { status: 400 });
  const made = await createInvite(session.userId!, note || null);
  if (!made) return Response.json({ error: `There are already ${MAX_OPEN_INVITES} unused codes. Revoke some first.` }, { status: 409 });
  await logAdminAction(session, "invite_made", { detail: note || null });
  return Response.json(made, { status: 201 });
}
