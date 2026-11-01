import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { CAST_METHODS, castLines, castRow, castSummary, cleanLineValues, linesToText, listCasts, loadCast, type CastMethod } from "@/lib/iching";

// The person's casts, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listCasts(session.userId));
}

// Casts the I Ching and saves the cast at once. Body: { method: "coins" | "yarrow" | "entered", lines?, question?, tz? }. For "coins" and "yarrow" the
// app makes the six lines with the random method the person chose in Settings; for "entered" the person gives the six lines they cast themselves,
// bottom first, as six digits 6, 7, 8 or 9 (a string such as "789678" or a list), and nothing is chosen by chance.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const method = body?.method as CastMethod;
  if (!CAST_METHODS.includes(method)) return Response.json({ error: "method must be coins, yarrow or entered" }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  let values;
  if (method === "entered") {
    values = cleanLineValues(body?.lines);
    if (!values) return Response.json({ error: "lines must be six numbers, each 6, 7, 8 or 9, bottom line first" }, { status: 400 });
  } else {
    values = castLines(method, await createRng(user?.rng_method ?? "math"));
  }

  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });
  const row = castRow(values);

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "iching",
      question: cleanText(body?.question),
      summary: castSummary(values),
      sky: JSON.stringify(sky),
    });
    await client.query(
      `INSERT INTO iching_casts (divination_id, user_id, method, lines, primary_number, primary_name, relating_number, relating_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [divinationId, userId, method, linesToText(values), row.primary_number, row.primary_name, row.relating_number, row.relating_name]
    );
    return divinationId;
  });

  return Response.json(await loadCast(userId, id), { status: 201 });
}
