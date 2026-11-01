import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { MAX_GROUP_NOTE_LENGTH, parseGroupNoteId } from "@/lib/card-groups";

// A person's own words for a whole suit or a whole number, kept like their words for a card: in card_customizations,
// with every version in card_meaning_revisions, under 'group-suit-cups' or 'group-rank-5' (lib/card-groups.ts). Nothing
// is written for them. Earlier versions are deleted through /api/cards/[id]/revisions/[rid], which works for any id.

interface Version {
  id: number;
  content: string;
  created_at: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const group = parseGroupNoteId(groupId);
  if (!group) return Response.json({ error: "Not found" }, { status: 404 });

  const [row, versions] = await Promise.all([
    queryOne<{ upright_description: string | null }>(
      "SELECT upright_description FROM card_customizations WHERE user_id = $1 AND card_id = $2",
      [session.userId, groupId]
    ),
    query<Version>(
      `SELECT id, upright_description AS content, created_at
       FROM card_meaning_revisions
       WHERE user_id = $1 AND card_id = $2 AND upright_description IS NOT NULL
       ORDER BY created_at DESC, id DESC`,
      [session.userId, groupId]
    ),
  ]);
  const content = row?.upright_description?.trim() || null;
  // Each save adds a version, so the newest one is the text now. The earlier wordings are the ones that differ from it.
  const earlier = versions.filter((v, i) => !(i === 0 && content !== null && v.content === content));
  return Response.json({ id: groupId, label: group.label, kind: group.kind, content, earlier });
}

// Saves the person's words. An empty text clears them; the earlier versions stay. Every change adds a version.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  if (!parseGroupNoteId(groupId)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || (body.content !== null && typeof body.content !== "string")) {
    return Response.json({ error: "content must be text" }, { status: 400 });
  }
  const content: string | null = typeof body.content === "string" ? body.content.trim() || null : null;
  if (content !== null && content.length > MAX_GROUP_NOTE_LENGTH) {
    return Response.json({ error: `A note can be up to ${MAX_GROUP_NOTE_LENGTH} characters.` }, { status: 400 });
  }

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT upright_description FROM card_customizations WHERE user_id = $1 AND card_id = $2",
      [userId, groupId]
    );
    const before: string | null = rows[0]?.upright_description?.trim() || null;
    if (content === null) {
      await client.query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [userId, groupId]);
      return;
    }
    await client.query(
      `INSERT INTO card_customizations (user_id, card_id, upright_description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, card_id) DO UPDATE SET
         upright_keywords     = NULL,
         reversed_keywords    = NULL,
         upright_description  = EXCLUDED.upright_description,
         reversed_description = NULL,
         updated_at           = NOW()`,
      [userId, groupId, content]
    );
    if (content !== before) {
      await client.query(
        "INSERT INTO card_meaning_revisions (user_id, card_id, upright_description) VALUES ($1, $2, $3)",
        [userId, groupId, content]
      );
    }
  });

  return Response.json({ ok: true, content });
}

// Removes the person's current words for this suit or number. Earlier versions are kept unless ?history=1 is added.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!parseGroupNoteId(groupId)) return Response.json({ error: "Not found" }, { status: 404 });

  await query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [session.userId, groupId]);
  if (new URL(req.url).searchParams.get("history") === "1") {
    await query("DELETE FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2", [session.userId, groupId]);
  }
  return new Response(null, { status: 204 });
}
