import { query } from "./db";
import type { DivinationKind } from "./divination-kinds";

// The two things every tool's `[id]` route does the same way for a reading of its kind: change the question written with it, and delete it. Both are
// scoped to the signed-in person and to the tool's kind, so a route cannot reach another person's reading or another tool's. The route itself
// checks who is asking before it calls either.

/** Changes the question of the person's reading of this kind (null clears it). False when there is no such reading. */
export async function setQuestionOf(userId: number, id: number, kind: DivinationKind, question: string | null): Promise<boolean> {
  const rows = await query("UPDATE divinations SET question = $1 WHERE id = $2 AND user_id = $3 AND kind = $4 RETURNING id", [question, id, userId, kind]);
  return rows.length > 0;
}

/** Deletes the reading: its shared record and, with it (ON DELETE CASCADE), the tool's rows, what was written about it and its predictions. False when there is no such reading. */
export async function deleteReadingOf(userId: number, id: number, kind: DivinationKind): Promise<boolean> {
  const rows = await query("DELETE FROM divinations WHERE id = $1 AND user_id = $2 AND kind = $3 RETURNING id", [id, userId, kind]);
  return rows.length > 0;
}
