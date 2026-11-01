import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { buildChart, castMothers, chartRows, chartSummary, listCharts, loadChart, mothersFromIds, mothersToText } from "@/lib/geomancy";

// The person's charts, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listCharts(session.userId));
}

// Casts a geomancy chart and saves it at once. Body: { method: "random" | "entered", mothers?, question?, tz? }. For "random" the app makes sixteen lines
// of single or double dots with the random method the person chose in Settings; for "entered" the person chooses the four Mothers themselves, as a list of
// four figure ids ("geomancy-via"), First Mother first, and nothing is chosen by chance. The rest of the chart follows by fixed rules.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const method = body?.method;
  if (method !== "random" && method !== "entered") return Response.json({ error: "method must be random or entered" }, { status: 400 });

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  let mothers;
  if (method === "entered") {
    mothers = mothersFromIds(body?.mothers);
    if (!mothers) return Response.json({ error: "mothers must be four figures, each one of the sixteen" }, { status: 400 });
  } else {
    mothers = castMothers(await createRng(user?.rng_method ?? "math"));
  }
  const chart = buildChart(mothers);

  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "geomancy",
      question: cleanText(body?.question),
      summary: chartSummary(chart),
      sky: JSON.stringify(sky),
    });
    await client.query("INSERT INTO geomancy_charts (divination_id, user_id, method, mothers) VALUES ($1, $2, $3, $4)", [divinationId, userId, method, mothersToText(mothers)]);
    const rows = chartRows(chart);
    await client.query(
      `INSERT INTO geomancy_figures (user_id, divination_id, place, figure_id, figure_name, sort_order)
       SELECT $1, $2, t.place, t.figure_id, t.figure_name, t.ord
       FROM unnest($3::text[], $4::text[], $5::text[], $6::int[]) AS t(place, figure_id, figure_name, ord)`,
      [userId, divinationId, rows.map((r) => r.place), rows.map((r) => r.figure.id), rows.map((r) => r.figure.latin), rows.map((r) => r.order)]
    );
    return divinationId;
  });

  return Response.json(await loadChart(userId, id), { status: 201 });
}
