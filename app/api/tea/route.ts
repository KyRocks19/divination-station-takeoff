import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { blotSummary, listCasts, loadCast, pickSeed } from "@/lib/blots";
import { isTeaKind } from "@/lib/tea-core";

// The person's cups of tea leaves, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listCasts(session.userId, "tea"));
}

// Brews a cup and saves the reading at once. Body: { tea?, question?, tz? }; tea is one of TEA_KINDS. The seed is picked by chance with the random method
// the person chose in Settings; the leaves are drawn from it, and drawn again the same way whenever the reading is opened.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  if (body?.tea != null && !isTeaKind(body.tea)) return Response.json({ error: "tea must be one of the listed teas" }, { status: 400 });
  const tea = isTeaKind(body?.tea) ? body.tea : null;

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const seed = pickSeed(rng);
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, { userId, kind: "tea", question: cleanText(body?.question), summary: blotSummary("cup", tea), sky: JSON.stringify(sky) });
    await client.query("INSERT INTO blot_casts (user_id, divination_id, vessel, seed, tea) VALUES ($1, $2, $3, $4, $5)", [userId, divinationId, "cup", seed, tea]);
    return divinationId;
  });

  return Response.json(await loadCast(userId, "tea", id), { status: 201 });
}
