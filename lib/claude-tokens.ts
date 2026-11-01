import { createHash, randomBytes } from "crypto";
import { query, queryOne } from "./db";
import { CLAUDE_TOKEN_PREFIX, MAX_PERSONAL_TOKENS, type PersonalTokenRow } from "./claude-tokens-core";

// A person's own tokens for the Claude tool routes (migration 070). The token is shown once; only its hash is kept. A token acts for the
// account that made it, only while that account is not switched off, and only until the person revokes it.

/** A new token: dsc_ and 32 random bytes in base64url. */
export function makeClaudeToken(): string {
  return CLAUDE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/** A token is 256 random bits, so a plain SHA-256 is enough (there is nothing to guess, unlike a password). */
export function hashClaudeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Makes a token and returns it; this is the only time it exists in readable form. Null when the person already has the most allowed. */
export async function createClaudeToken(userId: number, name: string): Promise<{ id: number; token: string } | null> {
  const open = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM claude_tokens WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  if ((open?.n ?? 0) >= MAX_PERSONAL_TOKENS) return null;
  const token = makeClaudeToken();
  const row = await queryOne<{ id: number }>(
    "INSERT INTO claude_tokens (user_id, name, token_hash) VALUES ($1, $2, $3) RETURNING id",
    [userId, name, hashClaudeToken(token)]
  );
  return { id: row!.id, token };
}

/** The person's tokens in use: names and dates, never the tokens. */
export async function listClaudeTokens(userId: number): Promise<PersonalTokenRow[]> {
  return query<PersonalTokenRow>(
    "SELECT id, name, created_at, last_used_at FROM claude_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC, id DESC",
    [userId]
  );
}

/** Revokes one of the person's own tokens. False when it is not theirs, already revoked, or not there. */
export async function revokeClaudeToken(userId: number, id: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    "UPDATE claude_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id",
    [id, userId]
  );
  return !!row;
}

/** The account a token acts for, or null for an unknown or revoked token or a switched-off account. Notes when it was last used. */
export async function userIdForClaudeToken(token: string): Promise<number | null> {
  const row = await queryOne<{ user_id: number }>(
    `UPDATE claude_tokens t SET last_used_at = NOW()
     FROM users u
     WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.id = t.user_id AND u.disabled = 0
     RETURNING t.user_id`,
    [hashClaudeToken(token)]
  );
  return row?.user_id ?? null;
}
