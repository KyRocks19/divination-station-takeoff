import { query } from "./db";

export * from "./playingcards-data";

// Playing cards, the database side (migration 085). A draw is one shared record (`divinations`, kind 'playingcards') plus one row per card in
// `playing_card_draws`. The person's own meaning for a card is in `card_customizations` under 'playing-H-7' and so on (lib/own-meaning.ts).

export interface PlayingDraw {
  /** The id of the shared record in `divinations`. */
  id: number;
  question: string | null;
  sky: string | null;
  created_at: string;
  cards: { card_id: string; card_name: string }[];
  entry_count: number;
}

async function findDraws(userId: number, id?: number): Promise<PlayingDraw[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d WHERE d.user_id = $1 AND d.kind = 'playingcards'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const draws = await query<Omit<PlayingDraw, "cards">>(sql, params);
  if (draws.length === 0) return [];
  const rows = await query<{ divination_id: number; card_id: string; card_name: string }>(
    "SELECT divination_id, card_id, card_name FROM playing_card_draws WHERE user_id = $1 AND divination_id = ANY($2) ORDER BY sort_order, id",
    [userId, draws.map((d) => d.id)]
  );
  return draws.map((d) => ({ ...d, cards: rows.filter((r) => r.divination_id === d.id).map(({ card_id, card_name }) => ({ card_id, card_name })) }));
}

export function listDraws(userId: number): Promise<PlayingDraw[]> {
  return findDraws(userId);
}

export async function loadDraw(userId: number, id: number): Promise<PlayingDraw | null> {
  if (!id) return null;
  return (await findDraws(userId, id))[0] ?? null;
}
