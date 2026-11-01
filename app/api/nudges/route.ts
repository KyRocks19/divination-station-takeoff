import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { dismissNudge, listNudges, parseDismissal } from "@/lib/nudges";

// The signed-in person's nudges for today's page: none when they turned the suggestions off in Settings.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await getPrefs(session.userId);
  if (!prefs.lookbackPrompts) return Response.json({ nudges: [], off: true });
  return Response.json({ nudges: await listNudges(session.userId, prefs.tools), off: false });
}

// Dismisses one nudge: { kind: "prediction" | "lookback" | "guess", id }. The prediction, reading or guess itself is untouched.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dismissal = parseDismissal(await request.json().catch(() => null));
  if (!dismissal) return Response.json({ error: "kind must be prediction, lookback or guess, and id a positive number" }, { status: 400 });
  if (!(await dismissNudge(session.userId, dismissal.kind, dismissal.id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
