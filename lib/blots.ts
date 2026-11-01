import { query } from "./db";
import type { Vessel } from "./blots-core";
import { isTeaKind, type TeaKind } from "./tea-core";

export * from "./blots-core";

// Shapes drawn from a seed, the database side (migration 087): tea leaves in a cup (tasseomancy, kind 'tea') and ink blots (kind 'blots').
// A reading is one shared record in `divinations` plus one row in `blot_casts` with the kind of shape and its seed. The two were one tool,
// kind 'blots', until 2026-10-29; migration 100 moves the cups saved before then to kind 'tea'. What the person sees in the shape is written
// as entries on the reading, like any other tool. Every query is for one person.

/** The two tools that keep their shapes in `blot_casts`. */
export type ShapeTool = "tea" | "blots";

export interface BlotCast {
  /** The id of the shared record in `divinations`. */
  id: number;
  /** The kind of the shared record: 'tea' for a cup, 'blots' for ink, or 'blots' for a cup saved before the split while migration 100 is owed. */
  kind: ShapeTool;
  question: string | null;
  sky: string | null;
  created_at: string;
  vessel: Vessel;
  seed: number;
  /** The tea chosen before a cup was read (migration 095); null for ink or for an older cup. */
  tea: TeaKind | null;
  entry_count: number;
}

// Until migration 100 is on live, a cup saved before the split still has kind 'blots'; the tea tool finds it by its vessel. Take the
// second half of the tea condition out once the owner says 100 is on live.
const WHICH: Record<ShapeTool, string> = {
  tea: "(d.kind = 'tea' OR (d.kind = 'blots' AND b.vessel = 'cup'))",
  blots: "d.kind = 'blots' AND b.vessel = 'ink'",
};

async function findCasts(userId: number, tool: ShapeTool, id?: number): Promise<BlotCast[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.kind, d.question, d.sky, d.created_at, b.vessel, b.seed, b.tea,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN blot_casts b ON b.divination_id = d.id
    WHERE d.user_id = $1 AND b.user_id = $1 AND ${WHICH[tool]}`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  const rows = await query<BlotCast>(sql, params);
  return rows.map((r) => ({ ...r, tea: isTeaKind(r.tea) ? r.tea : null }));
}

export function listCasts(userId: number, tool: ShapeTool): Promise<BlotCast[]> {
  return findCasts(userId, tool);
}

export async function loadCast(userId: number, tool: ShapeTool, id: number): Promise<BlotCast | null> {
  if (!id) return null;
  return (await findCasts(userId, tool, id))[0] ?? null;
}
