import { query } from "./db";
import type { NoteType } from "./signs-core";

export * from "./signs-core";

// The signs and dreams log, the database side (migration 085). A note is one shared record (`divinations`, kind 'signs') plus one row in `sign_notes`.
// Every query is for one person.

export interface SignNote {
  /** The id of the shared record in `divinations`. */
  id: number;
  question: string | null;
  sky: string | null;
  created_at: string;
  note_type: NoteType;
  body: string;
  /** 'YYYY-MM-DD', or null when no day was given. */
  happened_on: string | null;
  entry_count: number;
}

async function findNotes(userId: number, id?: number): Promise<SignNote[]> {
  const params: number[] = [userId];
  let sql = `
    SELECT d.id, d.question, d.sky, d.created_at, n.note_type, n.body, n.happened_on::text AS happened_on,
           (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id) AS entry_count
    FROM divinations d JOIN sign_notes n ON n.divination_id = d.id
    WHERE d.user_id = $1 AND n.user_id = $1 AND d.kind = 'signs'`;
  if (id) sql += ` AND d.id = $${params.push(id)}`;
  sql += " ORDER BY d.created_at DESC, d.id DESC";
  return query<SignNote>(sql, params);
}

export function listNotes(userId: number): Promise<SignNote[]> {
  return findNotes(userId);
}

export async function loadNote(userId: number, id: number): Promise<SignNote | null> {
  if (!id) return null;
  return (await findNotes(userId, id))[0] ?? null;
}
