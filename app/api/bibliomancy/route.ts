import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { cleanPullCount, cleanSources, isUnit, listReadings, loadReading, pullFromWriting, pullSummary } from "@/lib/bibliomancy";

// The person's readings, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listReadings(session.userId));
}

// Pulls words from the person's own past writing and saves the reading at once. Body: { unit: "word" | "phrase" | "sentence", count: 1 to 5,
// sources: ["journal", "day", "notes", "prediction", "meaning"], question?, tz? }. The app picks by chance with the random method the person chose in
// Settings. Only writing the person made is ever used (lib/bibliomancy.ts).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  if (!isUnit(body?.unit)) return Response.json({ error: "unit must be word, phrase or sentence" }, { status: 400 });
  const count = cleanPullCount(body?.count ?? 1);
  if (count === null) return Response.json({ error: "count must be a whole number from 1 to 5" }, { status: 400 });
  const sources = cleanSources(body?.sources);
  if (sources.length === 0) return Response.json({ error: "choose at least one place to pull from" }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");
  const made = await pullFromWriting(userId, sources, body.unit, count, rng);
  if ("error" in made) return Response.json({ error: made.error }, { status: 422 });

  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "bibliomancy",
      question: cleanText(body?.question),
      summary: pullSummary(made.pulls.map((p) => p.passage)),
      sky: JSON.stringify(sky),
    });
    for (const [i, p] of made.pulls.entries()) {
      await client.query(
        `INSERT INTO bibliomancy_pulls (user_id, divination_id, sort_order, unit, passage, context, source_kind, source_ref, source_label, source_when)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, divinationId, i, p.unit, p.passage, p.context, p.source_kind, p.source_ref, p.source_label, p.source_when]
      );
    }
    return divinationId;
  });

  return Response.json(await loadReading(userId, id), { status: 201 });
}
