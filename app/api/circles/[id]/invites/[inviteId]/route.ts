import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { revokeCircleInvite } from "@/lib/circles";
import { circleFailure } from "@/lib/circles-http";

// The owner stops an unused code from working.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const p = await params;
  const id = idParam(p.id);
  const inviteId = idParam(p.inviteId);
  if (!id || !inviteId) return Response.json({ error: "Not found" }, { status: 404 });
  return circleFailure(await revokeCircleInvite(who.userId, id, inviteId)) ?? new Response(null, { status: 204 });
}
