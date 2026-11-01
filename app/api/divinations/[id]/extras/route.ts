import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { bodyOf, idParam } from "@/lib/own-http";
import { cleanLookBackDay } from "@/lib/reading-extras-core";
import { getLookBack, sameQuestion, setLookBack } from "@/lib/reading-extras";

// Under every reading: the look-back reminder day and the person's other readings that asked the same question (release plan §6 ideas 2 and 5).
// GET: { look_back_on, same }. PATCH: { look_back_on: "YYYY-MM-DD" | null }. Only the reading's owner.
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const look = await getLookBack(session.userId, id);
  if (!look.found) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ look_back_on: look.on, same: await sameQuestion(session.userId, id) });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await bodyOf(request)) as { look_back_on?: unknown } | null;
  const day = cleanLookBackDay(body?.look_back_on);
  if (day === undefined) return Response.json({ error: "look_back_on must be a date (YYYY-MM-DD) or null" }, { status: 400 });
  if (!(await setLookBack(session.userId, id, day))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ look_back_on: day });
}
