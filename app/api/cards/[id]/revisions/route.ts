import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

// Every saved version of the user's own meaning for a card, newest first, plus what they wrote when it was drawn.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const revisions = await query(
    `SELECT id, upright_keywords AS "uprightKeywords", reversed_keywords AS "reversedKeywords",
            upright_description AS "uprightDescription", reversed_description AS "reversedDescription", created_at
     FROM card_meaning_revisions
     WHERE user_id = $1 AND card_id = $2
     ORDER BY created_at DESC, id DESC`,
    [session.userId, id]
  );

  const impressions = await query(
    `SELECT j.id, j.content, j.kind, j.created_at, j.reading_id, r.title, r.spread_name
     FROM journals j JOIN readings r ON r.id = j.reading_id
     WHERE r.user_id = $1 AND j.author = 'user' AND j.card_id = $2
     ORDER BY j.created_at DESC`,
    [session.userId, id]
  );

  return Response.json({ revisions, impressions });
}
