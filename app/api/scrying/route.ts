import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { cleanMinutes, isScryingSurface, listSessions, loadSession, surfaceLabel } from "@/lib/scrying";

// The person's scrying sessions, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listSessions(session.userId));
}

// Saves a session once the person has finished looking: which surface, an optional question, and how long
// they looked when they chose to keep that. What they saw is written afterwards, as journal entries.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  if (!body || !isScryingSurface(body.surface)) {
    return Response.json({ error: "surface must be 'mirror', 'ball', or 'water'" }, { status: 400 });
  }
  const surface = body.surface;

  // Snapshot of the sky at the moment the session was saved, in the person's own time zone when the browser sent one.
  const prefs = await getPrefs(userId);
  const sky = skyAt(new Date(), { tz: typeof body.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "scrying",
      question: cleanText(body.question),
      summary: surfaceLabel(surface),
      sky: JSON.stringify(sky),
    });
    await client.query(
      "INSERT INTO scrying_sessions (divination_id, user_id, surface, minutes) VALUES ($1, $2, $3, $4)",
      [divinationId, userId, surface, cleanMinutes(body.minutes)]
    );
    return divinationId;
  });

  return Response.json(await loadSession(userId, id), { status: 201 });
}
