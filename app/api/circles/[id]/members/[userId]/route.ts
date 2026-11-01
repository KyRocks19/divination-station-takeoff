import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { removeMember } from "@/lib/circles";
import { circleFailure } from "@/lib/circles-http";

// The owner takes someone out of the circle, or a member leaves (their own id). The owner cannot leave; they hand it over or delete it.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const p = await params;
  const id = idParam(p.id);
  const memberId = idParam(p.userId);
  if (!id || !memberId) return Response.json({ error: "Not found" }, { status: 404 });
  return circleFailure(await removeMember(who.userId, id, memberId)) ?? new Response(null, { status: 204 });
}
