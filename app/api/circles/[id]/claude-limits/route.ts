import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { setClaudeLimits } from "@/lib/circle-claude";
import { circleFailure } from "@/lib/circles-http";

// The owner sets how many Claude requests a day each member, and the circle as a whole, may make through the circle's key.
// Body: { member_limit, circle_limit }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  return circleFailure(await setClaudeLimits(who.userId, id, body?.member_limit, body?.circle_limit)) ?? Response.json({ ok: true });
}
