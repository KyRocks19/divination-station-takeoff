import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listDays } from "@/lib/days";

// The signed-in person's days that have something in them (their writing, things they kept, or readings unless they turned that off), newest first. Only their own.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await getPrefs(session.userId);
  return Response.json(await listDays(session.userId, 400, prefs.daysListReadings));
}
