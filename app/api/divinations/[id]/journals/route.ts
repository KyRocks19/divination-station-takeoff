import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ENTRY_KINDS, listEntries, type EntryKind } from "@/lib/divinations";
import { cleanText, toId } from "@/lib/oracle";
import { tooLong } from "@/lib/limits";
import { idParam, jsonBody } from "@/lib/own-http";

// What the person has written about one reading of any kind, oldest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const reading = await queryOne<{ id: number }>(
    "SELECT id FROM divinations WHERE id = $1 AND user_id = $2 AND kind <> 'tarot'",
    [toId(id), session.userId]
  );
  if (!reading) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await listEntries(session.userId, reading.id));
}

// Adds an entry in the person's own words. kind is "note" (the default), "impression" (what they noticed
// first), or "lookback" (what happened afterwards).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const reading = await queryOne<{ id: number }>(
    "SELECT id FROM divinations WHERE id = $1 AND user_id = $2 AND kind <> 'tarot'",
    [toId(id), session.userId]
  );
  if (!reading) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const content = cleanText(body.content);
  if (!content) return Response.json({ error: "content is required" }, { status: 400 });
  if (tooLong(content, 20000)) return Response.json({ error: "That entry is too long (20,000 characters)" }, { status: 400 });
  const kind: EntryKind = body.kind ?? "note";
  if (!ENTRY_KINDS.includes(kind)) {
    return Response.json({ error: "kind must be 'note', 'impression', or 'lookback'" }, { status: 400 });
  }

  const entry = await queryOne(
    `INSERT INTO journals (divination_id, author, content, kind, thinking_mind) VALUES ($1, 'user', $2, $3, $4)
     RETURNING id, kind, thinking_mind, content, created_at`,
    [reading.id, content, kind, body.thinking_mind ? 1 : 0]
  );
  return Response.json(entry, { status: 201 });
}
