import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { blotSummary, listCasts, loadCast, pickSeed } from "@/lib/blots";

// The person's ink blots, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listCasts(session.userId, "blots"));
}

// Presses an ink blot and saves the reading at once. Body: { question?, tz? }; a `vessel`, if sent, must be "ink" (tea leaves are made at /api/tea since
// 2026-10-29). The seed is picked by chance with the random method the person chose in Settings; the blot is drawn from it, and drawn again the same way
// whenever the reading is opened.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  if (body?.vessel != null && body.vessel !== "ink") return Response.json({ error: "vessel must be ink; tea leaves are made at /api/tea" }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const seed = pickSeed(rng);
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, { userId, kind: "blots", question: cleanText(body?.question), summary: blotSummary("ink"), sky: JSON.stringify(sky) });
    await client.query("INSERT INTO blot_casts (user_id, divination_id, vessel, seed, tea) VALUES ($1, $2, $3, $4, $5)", [userId, divinationId, "ink", seed, null]);
    return divinationId;
  });

  return Response.json(await loadCast(userId, "blots", id), { status: 201 });
}
