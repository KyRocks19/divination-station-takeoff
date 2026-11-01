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
  MAX_DRAW,
  RUNES,
  cleanChance,
  cleanCount,
  drawSummary,
  getRuneSettings,
  listDraws,
  loadDraw,
  saveRuneSettings,
  type DrawnRune,
} from "@/lib/runes";

// The person's draws, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listDraws(session.userId));
}

// Draws runes. The app picks the number asked for from the 24, each at most once, with the random method the person
// chose in Settings, and saves the draw at once. When the body carries the reversals choice it is saved as the
// person's choice; a rune that looks the same upside down never lands reversed.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  // With a layout, one rune is drawn for each position; without one, the person says how many.
  const chosen = await resolveLayout(userId, body?.layoutId, MAX_DRAW);
  if (chosen && "error" in chosen) return Response.json({ error: chosen.error }, { status: chosen.status });
  const layout = chosen?.layout ?? null;
  const count = layout ? layout.positions.length : cleanCount(body?.count ?? 1);
  if (count === null) return Response.json({ error: "count must be a whole number from 1 to 24" }, { status: 400 });

  const saved = await getRuneSettings(userId);
  const chance = body?.chance === undefined ? saved.chance : cleanChance(body.chance);
  if (chance === null) return Response.json({ error: "chance must be a whole number from 0 to 100" }, { status: 400 });
  const settings = { reversals: body?.reversals === undefined ? saved.reversals : body.reversals === true, chance };
  if (settings.reversals !== saved.reversals || settings.chance !== saved.chance) {
    await saveRuneSettings(userId, settings);
  }

  const [user, prefs] = await Promise.all([
    queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [userId]),
    getPrefs(userId),
  ]);
  const rng = await createRng(user?.rng_method ?? "math");

  // A partial shuffle: each step takes one rune out of the ones left, so no rune comes up twice.
  const bag = [...RUNES];
  const drawn: DrawnRune[] = [];
  for (let i = 0; i < count; i++) {
    const pick = Math.min(bag.length - 1, Math.floor(rng() * bag.length));
    const [rune] = bag.splice(pick, 1);
    const reversed = settings.reversals && rune.canReverse && rng() * 100 < settings.chance;
    drawn.push({ rune_id: rune.id, rune_name: rune.name, reversed, position_name: layout?.positions[i].name ?? null });
  }

  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "runes",
      question: cleanText(body?.question),
      summary: drawSummary(drawn),
      sky: JSON.stringify(sky),
      layoutId: layout?.id ?? null,
      layoutName: layout?.name ?? null,
    });
    for (const [i, r] of drawn.entries()) {
      await client.query(
        `INSERT INTO rune_draws (user_id, divination_id, rune_id, rune_name, reversed, sort_order, position_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, divinationId, r.rune_id, r.rune_name, r.reversed ? 1 : 0, i, r.position_name ?? null]
      );
    }
    return divinationId;
  });

  return Response.json(await loadDraw(userId, id), { status: 201 });
}
