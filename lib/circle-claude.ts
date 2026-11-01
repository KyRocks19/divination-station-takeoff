import Anthropic from "@anthropic-ai/sdk";
import { query, queryOne } from "./db";
import { masterKey, lastFour, open, seal } from "./secret-box";
import { cleanClaudeKey, MAX_CLAUDE_CIRCLE_LIMIT, MAX_CLAUDE_MEMBER_LIMIT, cleanClaudeLimit, type CircleProblem } from "./circles-core";
import { ownedCircle, membership, type Result } from "./circles";
import { dropWaitingCircleJobs } from "./image-queue";

// A circle's Claude key (open item C1, migration 065). The owner brings it; it is stored encrypted (lib/secret-box.ts), never sent back to any
// browser (the Circle page gets the last four characters, and only the owner), and used only for requests made by members of that circle who
// agreed to it. Server code only.

const aad = (circleId: number) => `circle:${circleId}`;
const done = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const fail = (problem: CircleProblem): { ok: false; problem: CircleProblem } => ({ ok: false, problem });

/**
 * Asks Anthropic whether it accepts the key (listing models costs nothing). "refused" only for a 401 or 403; when Anthropic cannot be reached the
 * key is kept, because a key that is right should not be thrown away because of a bad minute.
 */
export async function checkKeyWithAnthropic(apiKey: string): Promise<"ok" | "refused" | "unchecked"> {
  try {
    await new Anthropic({ apiKey, maxRetries: 0, timeout: 8000 }).models.list({ limit: 1 });
    return "ok";
  } catch (err) {
    const status = (err as { status?: number })?.status;
    return status === 401 || status === 403 ? "refused" : "unchecked";
  }
}

/** The owner stores (or replaces) the circle's key. Returns whether Anthropic could check it. */
export async function saveCircleKey(userId: number, circleId: number, raw: unknown): Promise<Result<{ checked: boolean }>> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  const apiKey = cleanClaudeKey(raw);
  if (!apiKey) return fail("key_bad");
  const master = masterKey();
  if (!master) return fail("key_unavailable");
  const verdict = await checkKeyWithAnthropic(apiKey);
  if (verdict === "refused") return fail("key_refused");
  const box = seal(apiKey, aad(circleId), master);
  await query(
    `INSERT INTO circle_claude_keys (circle_id, ciphertext, iv, tag, last4, set_by, set_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (circle_id) DO UPDATE SET ciphertext = $2, iv = $3, tag = $4, last4 = $5, set_by = $6, set_at = NOW()`,
    [circleId, box.ciphertext, box.iv, box.tag, lastFour(apiKey), userId]
  );
  return done({ checked: verdict === "ok" });
}

/** The owner takes the key out. Members' requests go back to the app's own key (if they still agree to nothing else). */
export async function removeCircleKey(userId: number, circleId: number): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  await query("DELETE FROM circle_claude_keys WHERE circle_id = $1", [circleId]);
  return done(undefined);
}

/** The owner's two daily limits on the circle's key (a number per member, a number for the circle). */
export async function setClaudeLimits(userId: number, circleId: number, memberLimit: unknown, circleLimit: unknown): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  const member = cleanClaudeLimit(memberLimit, MAX_CLAUDE_MEMBER_LIMIT);
  const circle = cleanClaudeLimit(circleLimit, MAX_CLAUDE_CIRCLE_LIMIT);
  if (member === null || circle === null) return fail("bad_limit");
  await query("UPDATE circles SET claude_member_daily_limit = $1, claude_daily_limit = $2 WHERE id = $3", [member, circle, circleId]);
  return done(undefined);
}

/** A member agrees to (or withdraws from) using the circle's key and picture computer for what they send. Their own place is checked, nobody else's. */
export async function setMyAgreement(userId: number, circleId: number, agreed: boolean): Promise<Result> {
  const m = await membership(userId);
  if (!m || m.circle_id !== circleId) return fail("not_found");
  await query("UPDATE circle_members SET shares_with_host_at = CASE WHEN $3 THEN COALESCE(shares_with_host_at, NOW()) ELSE NULL END WHERE circle_id = $1 AND user_id = $2", [
    circleId,
    userId,
    agreed,
  ]);
  if (!agreed) {
    // Their waiting pictures were meant for the circle's computer; they stop rather than quietly go somewhere else.
    await dropWaitingCircleJobs(circleId, userId, "You stopped using the circle's picture computer, so this picture will not be made. Ask again.");
  }
  return done(undefined);
}

export type CircleKeyFor = { circleId: number; apiKey: string } | { circleId: number; unreadable: true } | null;

/**
 * The key to use for this person's Claude request: their circle's, when they are in a circle that has one and they agreed to it; otherwise null
 * (the app's own key is used). `unreadable` when the stored key cannot be opened, for example because CIRCLE_KEY_SECRET was changed: the
 * request must then stop, not quietly spend the app's key instead.
 */
export async function circleKeyFor(userId: number): Promise<CircleKeyFor> {
  const row = await queryOne<{ circle_id: number; ciphertext: Buffer; iv: Buffer; tag: Buffer }>(
    `SELECT k.circle_id, k.ciphertext, k.iv, k.tag
     FROM circle_members m JOIN circle_claude_keys k ON k.circle_id = m.circle_id
     WHERE m.user_id = $1 AND m.shares_with_host_at IS NOT NULL`,
    [userId]
  );
  if (!row) return null;
  const master = masterKey();
  const apiKey = master ? open({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag }, aad(row.circle_id), master) : null;
  return apiKey ? { circleId: row.circle_id, apiKey } : { circleId: row.circle_id, unreadable: true };
}
