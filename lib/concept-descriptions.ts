import { query, queryOne } from "./db";

// The description Hiero wrote for one person on request (table concept_descriptions_user, migration 084). It belongs to that person alone:
// nobody else reads it, it goes with the account, and a person can remove it and ask again.

export async function getOwnDescription(userId: number, conceptId: number): Promise<string | null> {
  const row = await queryOne<{ body: string }>(
    "SELECT body FROM concept_descriptions_user WHERE user_id = $1 AND concept_id = $2",
    [userId, conceptId]
  );
  return row?.body ?? null;
}

/** Keeps the text for this person, replacing an earlier one. */
export async function saveOwnDescription(userId: number, conceptId: number, body: string): Promise<void> {
  await query(
    `INSERT INTO concept_descriptions_user (user_id, concept_id, body) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, concept_id) DO UPDATE SET body = EXCLUDED.body, generated_at = NOW()`,
    [userId, conceptId, body]
  );
}

export async function deleteOwnDescription(userId: number, conceptId: number): Promise<void> {
  await query("DELETE FROM concept_descriptions_user WHERE user_id = $1 AND concept_id = $2", [userId, conceptId]);
}
