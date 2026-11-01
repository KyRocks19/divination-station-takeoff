import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { MAX_DAY_BODY, getDay, isValidDay, saveBody } from "@/lib/days";

type Ctx = { params: Promise<{ date: string }> };

// One day for the signed-in person: their writing, what they kept, and (unless they turned it off) that day's readings.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { date } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isValidDay(date)) return Response.json({ error: "That is not a day I can use." }, { status: 400 });
  const prefs = await getPrefs(session.userId);
  return Response.json(await getDay(session.userId, date, prefs.daysListReadings));
}

// Saves the person's own writing for the day. { body: "markdown" }; an empty body clears it.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { date } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isValidDay(date)) return Response.json({ error: "That is not a day I can use." }, { status: 400 });
  const payload = await request.json().catch(() => null);
  if (typeof payload?.body !== "string") return Response.json({ error: "body must be text" }, { status: 400 });
  if (payload.body.length > MAX_DAY_BODY) return Response.json({ error: `A day's writing can be ${MAX_DAY_BODY.toLocaleString()} characters at most.` }, { status: 400 });
  await saveBody(session.userId, date, payload.body);
  return Response.json({ ok: true });
}
