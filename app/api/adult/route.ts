import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { adultConfirmed, setAdultConfirmed } from "@/lib/adult";

// "I am 18 or older": the person's own answer, saved on the account (users.adult_confirmed, migration 092). It unlocks the sensitive concepts and
// the AI features. Taking it back locks them again; nothing the person wrote is touched.

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ adult: await adultConfirmed(session.userId) });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.adult !== "boolean") return Response.json({ error: "adult must be true or false" }, { status: 400 });
  await setAdultConfirmed(session.userId, body.adult);
  return Response.json({ adult: body.adult });
}
