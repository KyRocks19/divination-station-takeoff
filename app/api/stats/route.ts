import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.userId;
  const sp = request.nextUrl.searchParams;
  const filterSpread = sp.get("spread");
  const filterCard = sp.get("card");

  const cardPositionParams: any[] = [userId];
  const cardPositionRows = await query(
    `SELECT
       card_id, card_name, position_name, spread_name,
       COUNT(*)                              AS total,
       SUM(reversed)                         AS reversed_count,
       COUNT(*) - SUM(reversed)              AS upright_count,
       MAX(created_at)                       AS last_drawn
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0
       ${filterSpread ? `AND spread_name = $${cardPositionParams.push(filterSpread)}` : ""}
       ${filterCard ? `AND card_id = $${cardPositionParams.push(filterCard)}` : ""}
     GROUP BY card_id, position_name, spread_name
     ORDER BY total DESC
     LIMIT 100`,
    cardPositionParams
  );

  const clarifierRows = await query(
    `SELECT
       card_id, card_name, clarifies_card_id, clarifies_position,
       COUNT(*)         AS total,
       SUM(reversed)    AS reversed_count,
       MAX(created_at)  AS last_drawn
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 1
     GROUP BY card_id, clarifies_card_id, clarifies_position
     ORDER BY total DESC
     LIMIT 50`,
    [userId]
  );

  const totals = await queryOne(
    `SELECT
       COUNT(*)                                            AS total_draws,
       SUM(CASE WHEN is_clarifier = 0 THEN 1 ELSE 0 END) AS spread_draws,
       SUM(CASE WHEN is_clarifier = 1 THEN 1 ELSE 0 END) AS clarifier_draws,
       SUM(reversed)                                       AS total_reversed,
       COUNT(DISTINCT reading_id)                          AS total_readings
     FROM card_draws
     WHERE user_id = $1`,
    [userId]
  );

  const hotCards = await query(
    `SELECT
       card_id, card_name,
       COUNT(*)      AS total,
       SUM(reversed) AS reversed_count
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0
     GROUP BY card_id, card_name
     ORDER BY total DESC
     LIMIT 20`,
    [userId]
  );

  return Response.json({ totals, cardPositionRows, clarifierRows, hotCards });
}
