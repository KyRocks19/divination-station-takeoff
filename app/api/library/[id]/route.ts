import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/library/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const draws = await query(
    `SELECT
       cd.reading_id,
       r.title,
       r.spread_name,
       r.question,
       cd.position_name,
       cd.reversed,
       cd.created_at
     FROM card_draws cd
     JOIN readings r ON r.id = cd.reading_id
     WHERE cd.user_id = $1 AND cd.card_id = $2 AND cd.is_clarifier = 0
     ORDER BY cd.created_at DESC`,
    [session.userId, id]
  ) as {
    reading_id: number;
    title: string | null;
    spread_name: string;
    question: string | null;
    position_name: string;
    reversed: number;
    created_at: string;
  }[];

  return Response.json({
    total: draws.length,
    draws: draws.map((d) => ({ ...d, reversed: !!d.reversed })),
  });
}
