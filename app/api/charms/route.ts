import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText, toId } from "@/lib/oracle";
import { MAX_CHARMS, castLandings, castSummary, castableCharms, listCasts, loadCast } from "@/lib/charms";

// The person's casts, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listCasts(session.userId));
}

// Casts every charm of one of the person's own charm sets onto the cloth and saves the reading at once. Body: { deckId, question?, tz? }.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const deckId = toId(body?.deckId);
  const charms = deckId ? await castableCharms(userId, deckId) : [];
  if (charms.length === 0) return Response.json({ error: "Choose one of your sets made of charms that has at least one charm to cast." }, { status: 422 });
  if (charms.length > MAX_CHARMS) return Response.json({ error: `A cast holds up to ${MAX_CHARMS} charms. Rest some charms in this set and try again.` }, { status: 422 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const landings = castLandings(charms.length, rng);
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "charms",
      question: cleanText(body?.question),
      summary: castSummary(charms.map((c) => c.name)),
      sky: JSON.stringify(sky),
    });
    for (const [i, c] of charms.entries()) {
      const l = landings[i];
      await client.query(
        "INSERT INTO charm_casts (user_id, divination_id, sort_order, set_name, card_id, charm_name, x, y, face) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [userId, divinationId, i, c.set_name, c.id, c.name, l.x, l.y, l.face]
      );
    }
    return divinationId;
  });

  return Response.json(await loadCast(userId, id), { status: 201 });
}
