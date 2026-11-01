import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanChance, getRuneSettings, saveRuneSettings } from "@/lib/runes";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getRuneSettings(session.userId));
}

// Only the fields present in the body are changed.
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const current = await getRuneSettings(session.userId);
  const chance = body?.chance === undefined ? current.chance : cleanChance(body.chance);
  if (chance === null) return Response.json({ error: "chance must be a whole number from 0 to 100" }, { status: 400 });
  const next = { reversals: body?.reversals === undefined ? current.reversals : body.reversals === true, chance };
  await saveRuneSettings(session.userId, next);
  return Response.json(next);
}
