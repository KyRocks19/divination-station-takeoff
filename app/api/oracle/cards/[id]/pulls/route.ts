import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listCardPulls, toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// The most recent earlier times a card came up, each with what the person wrote about that pull.
// ?except=<pull id> leaves out the pull being looked at.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const card = await queryOne<{ id: number }>(
    "SELECT id FROM oracle_cards WHERE id = $1 AND user_id = $2",
    [toId(id), session.userId]
  );
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const except = toId(request.nextUrl.searchParams.get("except"));
  return Response.json(await listCardPulls(session.userId, card.id, except));
}
