import { query } from "./db";
import { mothersFromText, type CastMethod } from "./geomancy-data";

export * from "./geomancy-data";

// Geomancy: a person casts four Mothers (the app picks sixteen lines of single or double dots with the person's own random method from Settings, or the
// person chooses the four Mothers themselves) and the rest of the chart follows by fixed rules (lib/geomancy-data.ts). A chart is one shared record
// (`divinations`, kind 'geomancy') plus one row in `geomancy_charts` and one row for each of its sixteen figures in `geomancy_figures` (migration 081). What
// each figure means to the person is kept in `card_customizations`, with every version in `card_meaning_revisions`, under ids like 'geomancy-via'.
// What the person makes of a chart is kept in `journals`, as for any reading.

/** One chart. `id` is the id of its shared record in `divinations`. */
export interface GeomancyChart {
  id: number;
  question: string | null;
  /** JSON snapshot of the sky when the chart was made. */
  sky: string | null;
  created_at: string;
  method: CastMethod;
  /** Sixteen digits: the four Mothers as dots, the top line first. */
  mothers: string;
  /** The sixteen figures, in the order of PLACES, as they were then. */
  figures: { place: string; figure_id: string; figure_name: string }[];
  /** How many entries the person has written about this chart. */
  entry_count: number;
}

async function findCharts(userId: number, id?: number): Promise<GeomancyChart[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, c.method, c.mothers,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN geomancy_charts c ON c.divination_id = d.id
    WHERE d.user_id = $1 AND c.user_id = $1 AND d.kind = 'geomancy'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const charts = await query<Omit<GeomancyChart, "figures">>(sql, params);
  if (charts.length === 0) return [];

  const rows = await query<{ divination_id: number; place: string; figure_id: string; figure_name: string }>(
    `SELECT divination_id, place, figure_id, figure_name FROM geomancy_figures
     WHERE user_id = $1 AND divination_id = ANY($2) ORDER BY sort_order ASC, id ASC`,
    [userId, charts.map((c) => c.id)]
  );
  return charts
    .filter((c) => mothersFromText(c.mothers))
    .map((c) => ({
      ...c,
      figures: rows.filter((r) => r.divination_id === c.id).map((r) => ({ place: r.place, figure_id: r.figure_id, figure_name: r.figure_name })),
    }));
}

/** The person's charts, newest first. */
export function listCharts(userId: number): Promise<GeomancyChart[]> {
  return findCharts(userId);
}

/** One chart, or null when it is not theirs. */
export async function loadChart(userId: number, id: number): Promise<GeomancyChart | null> {
  if (!id) return null;
  return (await findCharts(userId, id))[0] ?? null;
}
