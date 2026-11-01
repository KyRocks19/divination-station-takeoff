import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";
import { DAILY_OPTIONS, practiceNumbers } from "./remoteview-core";
import { recordFact } from "./remoteview-share";

// Daily five-choice trials (migration 086). One of five symbols is the target, picked by chance and kept hidden. The person gets a seal (a SHA-256 of the
// target and a random nonce) at the start and the nonce with the answer, so they can check the target was not changed after they chose. WHAT MAY BE READ
// WHEN is the rule of this file: a waiting trial returns only its id, date and seal; the target and nonce come back only for a judged trial. Every query is for
// one person, and a person can have one trial waiting at a time.

export interface DailyTrial {
  id: number;
  created_at: string;
  seal_hash: string;
  /** Present only once the trial is judged. */
  judged: null | { choice_index: number; target_index: number; nonce: string; hit: boolean };
}

interface Row {
  id: number;
  created_at: string;
  seal_hash: string;
  choice_index: number | null;
  target_index: number;
  nonce: string;
  judged_at: string | null;
}

const toTrial = (r: Row): DailyTrial => ({
  id: r.id,
  created_at: r.created_at,
  seal_hash: r.seal_hash,
  judged: r.judged_at && r.choice_index !== null ? { choice_index: r.choice_index, target_index: r.target_index, nonce: r.nonce, hit: r.choice_index === r.target_index } : null,
});

/** The text that is hashed to make the seal. The page checks the same text in the browser. */
export const sealText = (target: number, nonce: string) => `${target}:${nonce}`;

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export async function recentDaily(userId: number, limit = 30): Promise<DailyTrial[]> {
  const rows = await query<Row>(
    "SELECT id, created_at, seal_hash, choice_index, target_index, nonce, judged_at FROM remoteview_daily WHERE user_id = $1 ORDER BY id DESC LIMIT $2",
    [userId, limit]
  );
  return rows.map(toTrial);
}

export async function dailyNumbers(userId: number) {
  const [r] = await query<{ n: number; hits: number }>(
    "SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE choice_index = target_index)::int AS hits FROM remoteview_daily WHERE user_id = $1 AND judged_at IS NOT NULL",
    [userId]
  );
  return practiceNumbers(r?.n ?? 0, r?.hits ?? 0, 1 / DAILY_OPTIONS);
}

/** The trial waiting for a choice, or a new one. `target` is picked by the caller with the person's random method. */
export async function waitingOrNew(userId: number, target: number): Promise<DailyTrial> {
  const waiting = await query<Row>(
    "SELECT id, created_at, seal_hash, choice_index, target_index, nonce, judged_at FROM remoteview_daily WHERE user_id = $1 AND judged_at IS NULL",
    [userId]
  );
  if (waiting[0]) return toTrial(waiting[0]);
  const nonce = randomBytes(16).toString("hex");
  const made = await query<Row>(
    `INSERT INTO remoteview_daily (user_id, target_index, nonce, seal_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING RETURNING id, created_at, seal_hash, choice_index, target_index, nonce, judged_at`,
    [userId, target, nonce, hash(sealText(target, nonce))]
  );
  // A second request at the same moment finds the one the first made.
  const row = made[0] ?? (await query<Row>("SELECT id, created_at, seal_hash, choice_index, target_index, nonce, judged_at FROM remoteview_daily WHERE user_id = $1 AND judged_at IS NULL", [userId]))[0];
  return toTrial(row);
}

/** Records the choice, once. Null when the trial is not the person's or was already judged. */
export async function judgeDaily(userId: number, id: number, choice: number): Promise<DailyTrial | null> {
  const rows = await query<Row>(
    `UPDATE remoteview_daily SET choice_index = $3, judged_at = NOW() WHERE id = $1 AND user_id = $2 AND judged_at IS NULL
     RETURNING id, created_at, seal_hash, choice_index, target_index, nonce, judged_at`,
    [id, userId, choice]
  );
  if (!rows[0]) return null;
  const t = toTrial(rows[0]);
  await recordFact(userId, "daily5", DAILY_OPTIONS, t.judged!.hit);
  return t;
}
