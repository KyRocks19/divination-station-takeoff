import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { idParam, jsonBody } from "@/lib/own-http";

async function getOwnedReading(id: string, userId: number) {
  // An id that is not a whole number is "not found", not a database error.
  if (idParam(id) === null) return null;
  return queryOne(
    "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
    [id, userId]
  ) as Promise<any>;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/readings/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const reading = await getOwnedReading(id, session.userId);
  if (!reading) return Response.json({ error: "Not found" }, { status: 404 });
  const journals = await query(
    "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
    [id]
  );
  const prefs = await getPrefs(session.userId);
  const shared = await queryOne<{ id: number }>("SELECT id FROM divinations WHERE reading_id = $1 AND user_id = $2", [id, session.userId]);
  return Response.json({
    ...reading,
    divination_id: shared?.id ?? null,
    cards: JSON.parse(reading.cards),
    clarifiers: reading.clarifiers ? JSON.parse(reading.clarifiers) : {},
    sky: readingSky(reading, prefs.hemisphere),
    journals,
  });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/readings/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const reading = await getOwnedReading(id, session.userId);
  if (!reading) return Response.json({ error: "Not found" }, { status: 404 });
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { title, question, notes } = sent;
  await query(
    "UPDATE readings SET title = $1, question = $2, notes = $3 WHERE id = $4",
    [title ?? reading.title, question ?? reading.question, notes ?? reading.notes, id]
  );
  const updated = await queryOne("SELECT * FROM readings WHERE id = $1", [id]) as any;
  // Keep the shared record's title and question the same as the reading's.
  await query(
    "UPDATE divinations SET title = $1, question = $2 WHERE reading_id = $3",
    [updated.title, updated.question, id]
  );
  return Response.json({ ...updated, cards: JSON.parse(updated.cards) });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/readings/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const reading = await getOwnedReading(id, session.userId);
  if (!reading) return Response.json({ error: "Not found" }, { status: 404 });
  await query("DELETE FROM readings WHERE id = $1", [id]);
  return new Response(null, { status: 204 });
}
