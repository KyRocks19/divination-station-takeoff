import { query } from "./db";
import { cleanLineValues, type CastMethod, type LineValue } from "./iching-data";

export * from "./iching-data";

// The I Ching: a person casts six lines (the app tosses three coins or counts yarrow stalks for each, with the person's own random method from
// Settings, or the person casts them themselves and types them in). A cast is one shared record (`divinations`, kind 'iching') plus one row in
// `iching_casts` (migration 080). What each hexagram means to the person is kept in `card_customizations`, with every version in
// `card_meaning_revisions`, under ids like 'hexagram-12'. What the person makes of a cast is kept in `journals`, as for any reading.

/** One cast. `id` is the id of its shared record in `divinations`. */
export interface IChingCast {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the cast was made. */
  sky: string | null;
  created_at: string;
  method: CastMethod;
  /** Bottom line first. */
  lines: LineValue[];
  primary_number: number;
  primary_name: string;
  relating_number: number | null;
  relating_name: string | null;
  /** How many entries the person has written about this cast. */
  entry_count: number;
}

type Row = Omit<IChingCast, "lines"> & { lines: string };

async function findCasts(userId: number, id?: number): Promise<IChingCast[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, c.method, c.lines, c.primary_number, c.primary_name, c.relating_number, c.relating_name,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN iching_casts c ON c.divination_id = d.id
    WHERE d.user_id = $1 AND c.user_id = $1 AND d.kind = 'iching'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const rows = await query<Row>(sql, params);
  return rows.flatMap((r) => {
    const lines = cleanLineValues(r.lines);
    return lines ? [{ ...r, lines }] : [];
  });
}

/** The person's casts, newest first. */
export function listCasts(userId: number): Promise<IChingCast[]> {
  return findCasts(userId);
}

/** One cast, or null when it is not theirs. */
export async function loadCast(userId: number, id: number): Promise<IChingCast | null> {
  if (!id) return null;
  return (await findCasts(userId, id))[0] ?? null;
}
