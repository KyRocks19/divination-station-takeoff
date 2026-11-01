import { NextRequest } from "next/server";
import { requireUser } from "@/lib/own-http";
import { circleView, createCircle } from "@/lib/circles";
import { cleanCircleName, MAX_CIRCLE_NAME } from "@/lib/circles-core";
import { circleFailure } from "@/lib/circles-http";

// The signed-in person's circle (the members' names only, never their writing), and making a new one.
export async function GET() {
  const who = await requireUser();
  if ("response" in who) return who.response;
  return Response.json(await circleView(who.userId));
}

export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const body = await request.json().catch(() => null);
  const name = cleanCircleName(body?.name);
  if (!name) return Response.json({ error: `Give the circle a name of 1 to ${MAX_CIRCLE_NAME} characters.` }, { status: 400 });
  const result = await createCircle(who.userId, name);
  return circleFailure(result) ?? Response.json({ id: result.ok ? result.value : null }, { status: 201 });
}
