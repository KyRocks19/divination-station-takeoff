import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { handOverCircle } from "@/lib/circles";
import { circleFailure } from "@/lib/circles-http";

// The owner hands the circle to another member. Body: { user_id }.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const newOwner = typeof body?.user_id === "number" && Number.isInteger(body.user_id) && body.user_id > 0 ? body.user_id : null;
  if (!newOwner) return Response.json({ error: "user_id must be the id of a member" }, { status: 400 });
  return circleFailure(await handOverCircle(who.userId, id, newOwner)) ?? Response.json({ ok: true });
}
