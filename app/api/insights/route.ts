import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { countReadingsNotIn } from "@/lib/divinations";
import { readingSky, MOON_PHASE_ORDER, WEEKDAY_ORDER, type Sky } from "@/lib/sky";
import { archetypeTallies } from "@/lib/archetype-tallies";
import { ownTallies } from "@/lib/own-tallies";
import { loadToolSummaries } from "@/lib/tool-summary";
import { allClothCounts } from "@/lib/cloths";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.userId;

  const totals = await queryOne(
    `SELECT
       COUNT(*)                                              AS total_draws,
       SUM(CASE WHEN is_clarifier = 0 THEN 1 ELSE 0 END)   AS spread_draws,
       SUM(CASE WHEN is_clarifier = 1 THEN 1 ELSE 0 END)   AS clarifier_draws,
       SUM(reversed)                                         AS total_reversed,
       COUNT(DISTINCT reading_id)                            AS total_readings
     FROM card_draws WHERE user_id = $1`,
    [userId]
  );

  const suitRows = await query(
    `SELECT
       CASE
         WHEN card_id LIKE 'major-%'     THEN 'major'
         WHEN card_id LIKE 'cups-%'      THEN 'cups'
         WHEN card_id LIKE 'wands-%'     THEN 'wands'
         WHEN card_id LIKE 'swords-%'    THEN 'swords'
         WHEN card_id LIKE 'pentacles-%' THEN 'pentacles'
         ELSE 'unknown'
       END AS suit,
       COUNT(*) AS count
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0
     GROUP BY suit
     ORDER BY count DESC`,
    [userId]
  ) as { suit: string; count: number }[];

  const totalSuitDraws = suitRows.reduce((s, r) => s + Number(r.count), 0);
  const suitDistribution = suitRows.map((r) => ({
    ...r,
    count: Number(r.count),
    percentage: totalSuitDraws > 0 ? (Number(r.count) / totalSuitDraws) * 100 : 0,
  }));

  const baseCards = await query(
    `SELECT
       card_id, card_name,
       COUNT(*)                    AS total,
       SUM(reversed)               AS reversed_count,
       COUNT(*) - SUM(reversed)    AS upright_count,
       MIN(created_at)             AS first_drawn,
       MAX(created_at)             AS last_drawn
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0
     GROUP BY card_id, card_name
     HAVING COUNT(*) >= 2
     ORDER BY total DESC
     LIMIT 20`,
    [userId]
  ) as any[];

  const recurringCards = await Promise.all(
    baseCards.map(async (card: any) => {
      const positions = await query(
        `SELECT position_name, spread_name, COUNT(*) AS count, SUM(reversed) AS reversed_count
         FROM card_draws
         WHERE user_id = $1 AND card_id = $2 AND is_clarifier = 0
         GROUP BY position_name, spread_name
         ORDER BY count DESC`,
        [userId, card.card_id]
      );
      const readings = await query(
        `SELECT cd.reading_id, cd.position_name, cd.reversed, cd.created_at,
                r.question, r.title, r.spread_name
         FROM card_draws cd
         JOIN readings r ON r.id = cd.reading_id
         WHERE cd.user_id = $1 AND cd.card_id = $2 AND cd.is_clarifier = 0
         ORDER BY cd.created_at ASC`,
        [userId, card.card_id]
      );
      return { ...card, positions, readings };
    })
  );

  const mostClarified = await query(
    `SELECT
       clarifies_card_id    AS card_id,
       clarifies_position   AS position_name,
       COUNT(*)             AS clarifier_count
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 1 AND clarifies_card_id IS NOT NULL
     GROUP BY clarifies_card_id, clarifies_position
     ORDER BY clarifier_count DESC
     LIMIT 10`,
    [userId]
  );

  const topMajor = await queryOne(
    `SELECT card_id, card_name, COUNT(*) AS total
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0 AND card_id LIKE 'major-%'
     GROUP BY card_id, card_name
     ORDER BY total DESC
     LIMIT 1`,
    [userId]
  ) as { card_id: string; card_name: string; total: number } | null;

  const topMinor = await queryOne(
    `SELECT card_id, card_name, COUNT(*) AS total
     FROM card_draws
     WHERE user_id = $1 AND is_clarifier = 0 AND card_id NOT LIKE 'major-%'
     GROUP BY card_id, card_name
     ORDER BY total DESC
     LIMIT 1`,
    [userId]
  ) as { card_id: string; card_name: string; total: number } | null;

  const cardCountRows = await query<{ card_id: string; total: number }>(
    `SELECT card_id, COUNT(*) AS total
     FROM card_draws WHERE user_id = $1 AND is_clarifier = 0
     GROUP BY card_id`,
    [userId]
  );

  const cardCounts: Record<string, number> = {};
  for (const row of cardCountRows) cardCounts[row.card_id] = Number(row.total);

  // Which cards came up under which sky: readings grouped by moon phase and by planetary day.
  const prefs = await getPrefs(userId);
  const skyRows = await query<{ id: number; created_at: string; sky: string | null }>(
    "SELECT id, created_at, sky FROM readings WHERE user_id = $1",
    [userId]
  );
  const drawRows = await query<{ reading_id: number; card_name: string }>(
    "SELECT reading_id, card_name FROM card_draws WHERE user_id = $1 AND is_clarifier = 0",
    [userId]
  );
  const skyByReading = new Map(skyRows.map((r) => [r.id, readingSky(r, prefs.hemisphere)]));

  function groupBySky(keyOf: (sky: Sky) => string, order: string[]) {
    const groups = new Map<string, { readings: Set<number>; cards: Map<string, number> }>();
    for (const draw of drawRows) {
      const sky = skyByReading.get(draw.reading_id);
      if (!sky) continue;
      const key = keyOf(sky);
      const group = groups.get(key) ?? { readings: new Set<number>(), cards: new Map<string, number>() };
      group.readings.add(draw.reading_id);
      group.cards.set(draw.card_name, (group.cards.get(draw.card_name) ?? 0) + 1);
      groups.set(key, group);
    }
    return order.filter((key) => groups.has(key)).map((key) => {
      const group = groups.get(key)!;
      return {
        key,
        readings: group.readings.size,
        topCards: [...group.cards.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name, count]) => ({ name, count })),
      };
    });
  }

  const sky = {
    byMoonPhase: groupBySky((s) => s.moonPhase, MOON_PHASE_ORDER),
    byDay: groupBySky((s) => s.weekday, WEEKDAY_ORDER),
  };

  const archetypes = await archetypeTallies(userId);
  // The person's own archetypes and concepts, counted apart from the shared ones above and never added to them.
  const own = await ownTallies(userId);

  // A summary for each tool other than tarot, in the same shape tarot's suit chart has; the page shows the ones for the tools being shown.
  const toolSummaries = (await loadToolSummaries(userId, null)).filter((t) => t.kind !== "tarot");

  // Where items landed on the person's cloths, as plain counts (the page follows the tools being shown).
  const clothCounts = await allClothCounts(userId);

  // How many readings the saved choice of tools leaves out, for the "Show everything (n more)" link.
  const hiddenReadings = await countReadingsNotIn(userId, prefs.tools);

  return Response.json({ totals, suitDistribution, recurringCards, mostClarified, cardCounts, topMajor: topMajor ?? null, topMinor: topMinor ?? null, sky, archetypes, own, toolSummaries, clothCounts, hiddenReadings });
}
