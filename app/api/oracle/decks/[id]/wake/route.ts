import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// Puts every resting item of one of the person's sets back, so all of them can be drawn again. Nothing written on an item changes.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const woken = await query<{ id: number }>(
    "UPDATE oracle_cards SET resting = 0 WHERE deck_id = $1 AND user_id = $2 AND resting = 1 RETURNING id",
    [toId(id), session.userId]
  );
  return Response.json({ woken: woken.length });
}
