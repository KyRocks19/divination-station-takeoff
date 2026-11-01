import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { addCircleComputer } from "@/lib/circles";
import { circleFailure } from "@/lib/circles-http";

// The circle's owner adds a picture computer for the circle (body: { name }). The reply holds the token that computer's picture studio needs; it is
// shown once and cannot be fetched again (only a hash is kept). A circle's computer takes pictures asked for by this circle's members only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const result = await addCircleComputer(who.userId, id, body?.name);
  if (!result.ok) return circleFailure(result)!;
  console.info(`[worker-api] ${who.userId} made picture computer ${result.value.id} for circle ${id}`);
  return Response.json(result.value, { status: 201 });
}
