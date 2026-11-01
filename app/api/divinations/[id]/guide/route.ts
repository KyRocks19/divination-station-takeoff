import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listGuideEntries } from "@/lib/divinations";
import { cleanText, toId } from "@/lib/oracle";
import { tooLong } from "@/lib/limits";
import { idParam } from "@/lib/own-http";

// The guide's entries kept with one reading of any tool but tarot (a tarot reading keeps its own as journal entries with author "guide"). They are
// kept apart from the person's own writing, like the interviewer's: everything that reads the person's own words (the companion, Patterns,
// search) reads only author "user". The person deletes one with DELETE /api/divinations/[id]/journals/[jid].
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listGuideEntries(session.userId, toId(id)));
}

// Saves what the guide said, as the person asked: { content }.
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

  const body = await request.json().catch(() => ({}));
  const content = cleanText(body?.content);
  if (!content) return Response.json({ error: "content is required" }, { status: 400 });
  if (tooLong(content, 20000)) return Response.json({ error: "That entry is too long (20,000 characters)" }, { status: 400 });

  const entry = await queryOne(
    "INSERT INTO journals (divination_id, author, content) VALUES ($1, 'guide', $2) RETURNING id, content, created_at",
    [reading.id, content]
  );
  return Response.json(entry, { status: 201 });
}
