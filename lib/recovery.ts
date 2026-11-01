import { queryOne, withTransaction } from "./db";
import { hashCode, makeCode, normalizeCode, looksLikeCode } from "./invites";
import { recoveryCodesChanged } from "./seal";
import { RECOVERY_COUNT, type RecoveryStatus } from "./recovery-core";

// Recovery codes (open item S5): a way back into an account without email. A set is made in Settings after the password is asked
// again, shown once, and kept only as hashes. Each code works once at /recover. Using one sets a new password and signs every
// other session out. Making a new set discards the old unused ones.

/** A new set of distinct codes such as K7QM-2XPD-9TWR. */
export function makeRecoverySet(count = RECOVERY_COUNT): string[] {
  const set = new Set<string>();
  while (set.size < count) set.add(makeCode());
  return [...set];
}

export async function recoveryStatus(userId: number): Promise<RecoveryStatus> {
  const row = await queryOne<{ remaining: number; made_at: string | null }>(
    "SELECT COUNT(*) FILTER (WHERE used_at IS NULL)::int AS remaining, MAX(created_at) AS made_at FROM recovery_codes WHERE user_id = $1",
    [userId]
  );
  return { remaining: row?.remaining ?? 0, madeAt: row?.made_at ?? null };
}

/** Throws the old unused codes away and makes a new set. The readable codes exist only in this return value. */
export async function createRecoveryCodes(userId: number): Promise<string[]> {
  const codes = makeRecoverySet();
  await withTransaction(async (db) => {
    await db.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    for (const code of codes) {
      await db.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)", [userId, hashCode(normalizeCode(code))]);
    }
  });
  // On a locked copy the codes open the data too, when the passphrase is forgotten (lib/seal.ts).
  recoveryCodesChanged(userId, codes);
  return codes;
}

/**
 * Uses up a code if it belongs to this username, is unused, and the account is not switched off; returns the account's id.
 * The same answer (null) for an unknown name, a wrong code and a used code, so the page does not say which accounts exist.
 */
export async function redeemRecoveryCode(username: unknown, code: unknown): Promise<number | null> {
  const normalized = normalizeCode(code);
  if (typeof username !== "string" || !username.trim() || !looksLikeCode(normalized)) return null;
  const row = await queryOne<{ id: number }>(
    `UPDATE recovery_codes rc SET used_at = NOW()
     FROM users u
     WHERE rc.user_id = u.id AND LOWER(u.username) = LOWER($1) AND u.disabled = 0
       AND rc.code_hash = $2 AND rc.used_at IS NULL
     RETURNING u.id`,
    [username.trim(), hashCode(normalized)]
  );
  return row?.id ?? null;
}
