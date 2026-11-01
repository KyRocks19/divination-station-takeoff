import { query } from "./db";
import type { Face } from "./charms-core";

export * from "./charms-core";

// Charm casting, the database side (migration 085). A cast is one shared record (`divinations`, kind 'charms') plus one row per charm in `charm_casts`.
// The charms come from the person's own oracle sets of the form "charms"; the set's and each charm's name are kept as they were. Every query is for one person.

export interface CharmSet {
  id: number;
  name: string;
  /** Charms that can be cast (not resting). */
  charms: number;
}

/** The person's sets made of charms, each with how many charms can be cast. */
export function listCharmSets(userId: number): Promise<CharmSet[]> {
  return query<CharmSet>(
    `SELECT d.id, d.name, (SELECT COUNT(*)::int FROM oracle_cards c WHERE c.deck_id = d.id AND c.user_id = $1 AND c.resting = 0) AS charms
     FROM oracle_decks d WHERE d.user_id = $1 AND d.form = 'charms' ORDER BY d.name`,
    [userId]
  );
}

/** The castable charms of one of the person's charm sets. Empty for a set that is not theirs or not made of charms. */
export function castableCharms(userId: number, deckId: number): Promise<{ id: number; name: string; set_name: string }[]> {
  return query(
    `SELECT c.id, c.name, d.name AS set_name FROM oracle_cards c JOIN oracle_decks d ON d.id = c.deck_id
     WHERE d.id = $2 AND d.user_id = $1 AND c.user_id = $1 AND d.form = 'charms' AND c.resting = 0 ORDER BY c.id`,
    [userId, deckId]
  );
}

export interface CharmCast {
  /** The id of the shared record in `divinations`. */
  id: number;
  question: string | null;
  sky: string | null;
  created_at: string;
  set_name: string;
  charms: { card_id: number | null; charm_name: string; x: number; y: number; face: Face }[];
  entry_count: number;
}

async function findCasts(userId: number, id?: number): Promise<CharmCast[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d WHERE d.user_id = $1 AND d.kind = 'charms'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const casts = await query<Omit<CharmCast, "charms" | "set_name">>(sql, params);
  if (casts.length === 0) return [];
  const rows = await query<{ divination_id: number; set_name: string; card_id: number | null; charm_name: string; x: number; y: number; face: Face }>(
    `SELECT divination_id, set_name, card_id, charm_name, x, y, face FROM charm_casts WHERE user_id = $1 AND divination_id = ANY($2) ORDER BY sort_order, id`,
    [userId, casts.map((c) => c.id)]
  );
  return casts.map((c) => {
    const mine = rows.filter((r) => r.divination_id === c.id);
    return { ...c, set_name: mine[0]?.set_name ?? "", charms: mine.map(({ card_id, charm_name, x, y, face }) => ({ card_id, charm_name, x, y, face })) };
  });
}

export function listCasts(userId: number): Promise<CharmCast[]> {
  return findCasts(userId);
}

export async function loadCast(userId: number, id: number): Promise<CharmCast | null> {
  if (!id) return null;
  return (await findCasts(userId, id))[0] ?? null;
}
