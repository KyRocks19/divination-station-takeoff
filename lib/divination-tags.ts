import { query } from "./db";

// Tags on readings with any tool but tarot (migration 083), for the Readings list. Every query is for one person.

export interface DivinationTag {
  id: number;
  name: string;
  color: string;
}

/** The tags on each of the person's readings (by the id of its shared record). */
export async function tagsByDivination(userId: number): Promise<Map<number, DivinationTag[]>> {
  const map = new Map<number, DivinationTag[]>();
  const rows = await query<{ divination_id: number; id: number; name: string; color: string }>(
    `SELECT dt.divination_id, t.id, t.name, t.color
     FROM divination_tags dt JOIN tags t ON t.id = dt.tag_id JOIN divinations d ON d.id = dt.divination_id
     WHERE t.user_id = $1 AND d.user_id = $1 ORDER BY t.name`,
    [userId]
  );
  for (const r of rows) map.set(r.divination_id, [...(map.get(r.divination_id) ?? []), { id: r.id, name: r.name, color: r.color }]);
  return map;
}

/** The ids of the person's readings that carry one of their tags. */
export async function divinationIdsWithTag(userId: number, tagId: number): Promise<Set<number>> {
  const rows = await query<{ divination_id: number }>(
    `SELECT dt.divination_id FROM divination_tags dt JOIN tags t ON t.id = dt.tag_id JOIN divinations d ON d.id = dt.divination_id
     WHERE dt.tag_id = $1 AND t.user_id = $2 AND d.user_id = $2`,
    [tagId, userId]
  );
  return new Set(rows.map((r) => r.divination_id));
}
