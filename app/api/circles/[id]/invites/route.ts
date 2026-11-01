import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { createCircleInvite } from "@/lib/circles";
import { cleanCircleNote } from "@/lib/circles-core";
import { circleFailure } from "@/lib/circles-http";

// The owner makes a single-use code. This answer is the only time the code can be read; only its hash is kept.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const result = await createCircleInvite(who.userId, id, cleanCircleNote(body?.note));
  if (!result.ok) return circleFailure(result)!;
  return Response.json(result.value, { status: 201, headers: { "Cache-Control": "no-store" } });
}
