import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await query<{ card_id: string; total: number }>(
    `SELECT card_id, COUNT(*) AS total
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0
     GROUP BY card_id`,
    [session.userId]
  );

  const cardCounts: Record<string, number> = {};
  for (const row of rows) cardCounts[row.card_id] = Number(row.total);

  return Response.json({ cardCounts });
}
