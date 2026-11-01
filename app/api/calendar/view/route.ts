import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { noteView } from "@/lib/calendar";

// Counts one opening of one of the signed-in person's readings, from the address of the page they opened: { path: "/runes/12" }. The calendar uses the
// counts to show the reading of each day they went back to most. Sent by components/ReadingViewCounter.tsx; any other address counts nothing.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const path = typeof payload?.path === "string" ? payload.path.slice(0, 200) : "";
  return Response.json({ counted: await noteView(session.userId, path) });
}
