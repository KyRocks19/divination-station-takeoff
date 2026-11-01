import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { resolveLayout } from "@/lib/layouts";
import {
  cleanCount,
  drawSummary,
  getOghamSettings,
  listDraws,
  loadDraw,
  saveOghamSettings,
  stavesFor,
  type DrawnStave,
} from "@/lib/ogham";

// The person's draws, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listDraws(session.userId));
}

// Draws staves. The app picks the number asked for from the 20 ogham letters (25 when the person includes the later
// letters), each at most once, with the random method the person chose in Settings, and saves the draw at once.
// When the body carries the choice about the later letters it is saved as the person's choice.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);

  const saved = await getOghamSettings(userId);
  const forfeda = body?.forfeda === undefined ? saved.forfeda : body.forfeda === true;
  if (forfeda !== saved.forfeda) await saveOghamSettings(userId, { ...saved, forfeda });

  // With a layout, one stave is drawn for each position; without one, the person says how many.
  const chosen = await resolveLayout(userId, body?.layoutId, stavesFor(forfeda).length);
  if (chosen && "error" in chosen) return Response.json({ error: chosen.error }, { status: chosen.status });
  const layout = chosen?.layout ?? null;
  const count = layout ? layout.positions.length : cleanCount(body?.count ?? 1, forfeda);
  if (count === null) {
    return Response.json({ error: `count must be a whole number from 1 to ${forfeda ? 25 : 20}` }, { status: 400 });
  }

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");

  // A partial shuffle: each step takes one stave out of the ones left, so no stave comes up twice.
  const bag = [...stavesFor(forfeda)];
  const drawn: DrawnStave[] = [];
  for (let i = 0; i < count; i++) {
    const pick = Math.min(bag.length - 1, Math.floor(rng() * bag.length));
    const [stave] = bag.splice(pick, 1);
    drawn.push({ stave_id: stave.id, stave_name: stave.name, position_name: layout?.positions[i].name ?? null });
  }

  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "ogham",
      question: cleanText(body?.question),
      summary: drawSummary(drawn),
      sky: JSON.stringify(sky),
      layoutId: layout?.id ?? null,
      layoutName: layout?.name ?? null,
    });
    for (const [i, s] of drawn.entries()) {
      await client.query(
        `INSERT INTO ogham_draws (user_id, divination_id, stave_id, stave_name, sort_order, position_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, divinationId, s.stave_id, s.stave_name, i, s.position_name ?? null]
      );
    }
    return divinationId;
  });

  return Response.json(await loadDraw(userId, id), { status: 201 });
}
