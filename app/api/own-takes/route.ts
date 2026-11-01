import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { OWN_TAKE_MAX_LENGTH, cleanOwnTake } from "@/lib/divination-takes-core";
import { addOwnTake } from "@/lib/divination-takes";

// A person writing a take of their own on divination (migration 098): POST /api/own-takes with { "text": "..." }. Only they
// see it, on the Divination archetype page and now and then under the home page title. The answer holds only their own take.

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const text = cleanOwnTake(body?.text);
  if (!text) return Response.json({ error: `A take is one line of up to ${OWN_TAKE_MAX_LENGTH} characters` }, { status: 400 });
  const result = await addOwnTake(session.userId, text);
  if (!result.ok && result.error === "limit") return Response.json({ error: "You have written as many takes as can be kept" }, { status: 409 });
  if (!result.ok) return Response.json({ error: "Writing takes is not ready on this copy yet" }, { status: 503 });
  return Response.json({ take: result.take }, { status: 201, headers: NO_STORE });
}
