import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { saveWheel } from "@/lib/calendar";
import { parseWheel } from "@/lib/calendar-core";

// The signed-in person's changes to the festivals on their calendar: { hidden, names, dates, own } (lib/calendar-core.ts). Anything that does not
// make sense is dropped, so what is saved is what parseWheel reads back. Sending empty lists puts the usual eight back.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return Response.json({ error: "Send the festival choices." }, { status: 400 });
  const choices = parseWheel(payload);
  await saveWheel(session.userId, choices);
  return Response.json(choices);
}
