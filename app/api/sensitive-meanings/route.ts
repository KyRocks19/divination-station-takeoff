import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sensitiveCount, showsSensitive } from "@/lib/concept-visibility";
import { NEEDS_ADULT_MESSAGE, adultConfirmed } from "@/lib/adult";

// "Show sensitive meanings": the person's own choice, saved on the account (users.show_sensitive, migration 084). Off until they turn it on.

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ show: await showsSensitive(session.userId), count: await sensitiveCount(), adult: await adultConfirmed(session.userId) });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.show !== "boolean") return Response.json({ error: "show must be true or false" }, { status: 400 });
  if (body.show && !(await adultConfirmed(session.userId))) return Response.json({ error: NEEDS_ADULT_MESSAGE, code: "needs_adult" }, { status: 403 });

  await query("UPDATE users SET show_sensitive = $1 WHERE id = $2", [body.show, session.userId]);
  return Response.json({ show: body.show });
}
