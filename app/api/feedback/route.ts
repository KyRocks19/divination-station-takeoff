import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { addFeedback, cleanFeedback, listAll, listOwn } from "@/lib/feedback";

// The person's own notes to the owner; with ?all=1, the owner reads everyone's.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (request.nextUrl.searchParams.get("all") === "1") {
    if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
    return Response.json(await listAll());
  }
  return Response.json(await listOwn(session.userId));
}

// Sends a note. Body: { kind, message, page?, device? }.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const checked = cleanFeedback(await request.json().catch(() => null));
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
  const result = await addFeedback(session.userId, checked.input);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.id }, { status: 201 });
}
