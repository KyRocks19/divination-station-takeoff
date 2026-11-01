import { NextRequest } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { createRng } from "@/lib/rng";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { cleanText } from "@/lib/oracle";
import { resolveLayout } from "@/lib/layouts";
import { MAX_POSITIONS } from "@/lib/layouts-shared";
import { cleanThrowItems, facesOf, listThrows, loadThrow, throwSummaryOf, type DiceObjectId } from "@/lib/dice";

// The person's throws, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listThrows(session.userId));
}

// Throws a coin or dice, one kind of object or several in the same throw (`items`: [{ object, count }], or the older
// single `object` and `count`). Each face is picked by chance with the random method the person chose in Settings, with
// replacement. With a layout, one is thrown for each position (a throw can repeat a face, so the layout only has to
// fit the layout limit); without one, the person says how many.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const asked = cleanThrowItems(body);
  if ("error" in asked) return Response.json({ error: asked.error }, { status: 400 });

  const chosen = await resolveLayout(userId, body?.layoutId, MAX_POSITIONS);
  if (chosen && "error" in chosen) return Response.json({ error: chosen.error }, { status: chosen.status });
  const layout = chosen?.layout ?? null;
  // A layout gives one position for each result, so it goes with one kind of object.
  if (layout && asked.items.length > 1) {
    return Response.json({ error: "a layout works with one kind of object" }, { status: 400 });
  }
  // The object of each result, in the order they are thrown.
  const objects: DiceObjectId[] = layout
    ? layout.positions.map(() => asked.items[0].object)
    : asked.items.flatMap((i) => Array.from({ length: i.count }, () => i.object));

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");

  const thrown = objects.map((object) => {
    const faces = facesOf(object);
    return { object, face: faces[Math.min(faces.length - 1, Math.floor(rng() * faces.length))] };
  });

  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "dice",
      question: cleanText(body?.question),
      summary: throwSummaryOf(thrown),
      sky: JSON.stringify(sky),
      layoutId: layout?.id ?? null,
      layoutName: layout?.name ?? null,
    });
    await client.query(
      `INSERT INTO dice_throws (user_id, divination_id, object, face, position_name, sort_order)
       SELECT $1, $2, t.object, t.face, t.position_name, t.ord
       FROM unnest($3::text[], $4::text[], $5::text[], $6::int[]) AS t(object, face, position_name, ord)`,
      [
        userId,
        divinationId,
        thrown.map((t) => t.object),
        thrown.map((t) => t.face),
        thrown.map((_, i) => layout?.positions[i].name ?? null),
        thrown.map((_, i) => i),
      ]
    );
    return divinationId;
  });

  return Response.json(await loadThrow(userId, id), { status: 201 });
}
