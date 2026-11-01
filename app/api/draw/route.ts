import { NextRequest } from "next/server";
import { drawCards } from "@/lib/cards";
import { createRng } from "@/lib/rng";
import { getSession } from "@/lib/session";
import { queryOne } from "@/lib/db";
import { jsonBody } from "@/lib/own-http";

export async function POST(request: NextRequest) {
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { count } = sent;
  if (!count || count < 1 || count > 78) {
    return Response.json({ error: "count must be between 1 and 78" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const row = await queryOne<{ rng_method: string | null }>(
    "SELECT rng_method FROM users WHERE id = $1",
    [session.userId]
  );
  const rngMethod = row?.rng_method ?? "math";

  const rng = await createRng(rngMethod);
  const cards = drawCards(count, rng);
  const reversed = cards.map(() => rng() < 0.3);

  return Response.json({ cards, reversed });
}
