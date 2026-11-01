import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText } from "@/lib/oracle";
import {
  LAST_ANGLE_EXACT,
  MAX_SWINGS,
  MAX_SWING_NAME_LENGTH,
  cleanAngle,
  ensureSwings,
  listSwings,
  loadSwing,
  splitAngle,
} from "@/lib/pendulum";

// The person's swings with their earlier wordings. The five starting swings are made the first time.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listSwings(session.userId));
}

// Adds a swing: a straight line at an angle the person chooses, from 0 to 179.9 degrees in steps of a tenth,
// clockwise from straight up and down. A name is optional. An angle can be used more than once (the name tells the
// swings apart), up to MAX_SWINGS swings in all.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const angle = cleanAngle(body?.angle);
  if (angle === null) {
    return Response.json({ error: `angle must be a number from 0 to ${LAST_ANGLE_EXACT}, in steps of 0.1` }, { status: 400 });
  }
  const name = cleanText(body?.name)?.slice(0, MAX_SWING_NAME_LENGTH) ?? null;
  const { whole, tenths } = splitAngle(angle);

  await ensureSwings(userId);
  const count = await queryOne<{ c: number }>("SELECT COUNT(*)::int AS c FROM pendulum_swings WHERE user_id = $1", [userId]);
  if ((count?.c ?? 0) >= MAX_SWINGS) {
    return Response.json({ error: `You have ${MAX_SWINGS} swings, which is the most the app keeps. Remove one first.` }, { status: 409 });
  }
  const added = await queryOne<{ id: number }>(
    `INSERT INTO pendulum_swings (user_id, shape, angle, angle_tenths, name, builtin, sort_order)
     VALUES ($1, 'line', $2, $3, $4, 0, 100)
     RETURNING id`,
    [userId, whole, tenths, name]
  );
  if (!added) return Response.json({ error: "Could not add the swing. Nothing was added." }, { status: 500 });

  return Response.json(await loadSwing(userId, added.id), { status: 201 });
}
