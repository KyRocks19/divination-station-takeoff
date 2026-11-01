import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { setMyAgreement } from "@/lib/circle-claude";
import { circleFailure } from "@/lib/circles-http";

// A member agrees to, or withdraws from, using the circle owner's Claude key and picture computer for what they send. Only their own place is
// ever changed. Body: { agreed: true | false }.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (typeof body?.agreed !== "boolean") return Response.json({ error: "agreed must be true or false" }, { status: 400 });
  return circleFailure(await setMyAgreement(who.userId, id, body.agreed)) ?? Response.json({ ok: true });
}
