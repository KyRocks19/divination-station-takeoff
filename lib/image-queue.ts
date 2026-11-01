import { query, queryOne, withTransaction, getSetting, setSetting } from "./db";
import { MAX_BATCH, MAX_SCENE_LENGTH, MAX_STYLE_LENGTH, cleanBatch } from "./art-maker";
import { cleanForm } from "./oracle-forms";
import { quotaTimeZone } from "./ai-quota";
import { studioAliveFromRedis } from "./studio-signal";

// The queue of pictures for the owner's computer (migration 041). Used by the website's routes, including the worker API (app/api/worker/**)
// that the picture studio (scripts/image-worker.ts) talks to. `workerId` is the worker token that claimed a job (migration 062); a worker can
// only finish or fail its own jobs.

/** Pictures waiting or being made, per person. It follows the biggest batch (MAX_BATCH in lib/art-maker.ts), so one batch always fits. */
export const MAX_ACTIVE_PER_USER = MAX_BATCH;
/** Waiting, being made, or finished and not yet collected, per person. Finished pictures sit in the database, so this keeps it small. */
export const MAX_UNCOLLECTED_PER_USER = MAX_BATCH * 2;
export const DEFAULT_DAILY_PICTURES = 150;
/** A finished picture is kept this long for the person to collect; a job still waiting after this long is given up. */
export const JOB_LIFETIME_HOURS = 36;
/** The largest picture kept in the database, in bytes (the worker saves it as WebP, far below this). */
export { MAX_RESULT_BYTES } from "./worker-protocol";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** "queue" when pictures wait for the owner's computer; "direct" when this server can call the image tool itself. */
export function imageMode(env: Record<string, string | undefined> = process.env): "direct" | "queue" {
  if (env.IMAGE_MODE === "queue" || env.IMAGE_MODE === "direct") return env.IMAGE_MODE;
  return env.IMAGE_GEN_URL?.trim() ? "direct" : "queue";
}

/** A person's daily number of pictures: their own limit, otherwise IMAGE_DAILY_LIMIT, otherwise 30. */
export function dailyPictureLimit(override: number | null | undefined, envValue = process.env.IMAGE_DAILY_LIMIT): number {
  if (typeof override === "number" && Number.isInteger(override) && override >= 0) return override;
  const n = Number(envValue);
  return envValue !== undefined && envValue !== "" && Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAILY_PICTURES;
}

export interface JobInput {
  prompt: string;
  form: string;
  count: number;
  cardId: number | null;
}

/** Checks the body of a request for pictures. The words are the person's own; only their length and the form are checked. */
export function cleanJobInput(body: unknown): { ok: true; input: JobInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt) return { ok: false, error: "prompt is required" };
  if (prompt.length > MAX_SCENE_LENGTH + MAX_STYLE_LENGTH + 2) return { ok: false, error: "That description is too long" };
  const form = b.form === undefined ? "cards" : cleanForm(b.form);
  if (!form) return { ok: false, error: "form must be cards, stones, staves, or charms" };
  const count = cleanBatch(b.count ?? 1);
  const cardRaw = b.card_id;
  const cardId = cardRaw === undefined || cardRaw === null ? null : Number(cardRaw);
  if (cardId !== null && (!Number.isInteger(cardId) || cardId <= 0 || cardId > 2147483647)) return { ok: false, error: "card_id is not valid" };
  return { ok: true, input: { prompt, form, count, cardId } };
}

// --- The studio: is the program on the owner's computer running? ---

/** What the worker writes to the `settings` table (key 'image_worker') each time it checks the queue. */
export interface Heartbeat {
  at: string;
  /** How often it checks when nothing is waiting, in seconds; 0 when it is woken by the website instead. */
  pollSeconds: number;
}

export function parseHeartbeat(raw: string | null): Heartbeat | null {
  if (!raw) return null;
  try {
    const h = JSON.parse(raw);
    return typeof h?.at === "string" && Number.isFinite(Date.parse(h.at)) && Number.isFinite(h.pollSeconds) ? { at: h.at, pollSeconds: Number(h.pollSeconds) } : null;
  } catch {
    return null;
  }
}

/** Where a queue's heartbeat is kept: the app's own studio under `image_worker`, a circle's picture computer under its own key. */
const heartbeatKey = (circleId: number | null) => (circleId === null ? "image_worker" : `image_worker:circle:${circleId}`);

/** Records the studio's check-in (the worker API calls this when the studio looks at the queue), or that it stopped (`asleep`). `circleId` is the circle a circle's computer belongs to. */
export async function recordHeartbeat(pollSeconds: number, asleep = false, now = new Date(), circleId: number | null = null): Promise<void> {
  const hb: Heartbeat = { at: asleep ? new Date(0).toISOString() : now.toISOString(), pollSeconds };
  await setSetting(heartbeatKey(circleId), JSON.stringify(hb));
}

/** True when the worker has checked in recently enough that a new job will be picked up soon. */
export function studioAwake(hb: Heartbeat | null, now = new Date()): boolean {
  if (!hb) return false;
  const waitMs = Math.max(hb.pollSeconds, 60) * 1000 * 1.5 + 60_000;
  return now.getTime() - Date.parse(hb.at) < waitMs;
}

/**
 * With the Redis doorbell set up, the studio's flag in Redis decides (it expires about a minute after the window closes, and
 * asking costs the database nothing). When Redis is not set up or does not answer, the heartbeat in the database decides.
 */
export async function studioStatus(now = new Date(), circleId: number | null = null): Promise<{ awake: boolean; lastSeen: string | null }> {
  // A circle's computer has no doorbell (the owner's Redis is not shared with other people's computers): its heartbeat in the database decides.
  if (circleId !== null) {
    const hb = parseHeartbeat(await getSetting(heartbeatKey(circleId)).catch(() => null));
    return { awake: studioAwake(hb, now), lastSeen: hb?.at ?? null };
  }
  const alive = await studioAliveFromRedis();
  if (alive !== null) return { awake: alive, lastSeen: alive ? now.toISOString() : null };
  const hb = parseHeartbeat(await getSetting("image_worker").catch(() => null));
  return { awake: studioAwake(hb, now), lastSeen: hb?.at ?? null };
}

// --- Limits and the queue ---

/** The circle's name, for the page to say "your circle's picture computer" with the circle's own name. */
export async function circleStudioName(circleId: number): Promise<string | null> {
  const row = await queryOne<{ name: string }>("SELECT name FROM circles WHERE id = $1", [circleId]);
  return row?.name ?? null;
}

export type EnqueueResult = { ok: true; ids: number[]; circleId: number | null } | { ok: false; status: number; error: string };

/**
 * The circle whose picture computer makes this person's pictures: their circle, when they agreed to use it and it has a picture computer
 * (a token that is not revoked). Null means the app's own studio, as before circles.
 */
export async function pictureCircleOf(userId: number): Promise<number | null> {
  const sql = `SELECT m.circle_id FROM circle_members m
               WHERE m.user_id = $1 AND m.shares_with_host_at IS NOT NULL
                 AND EXISTS (SELECT 1 FROM worker_tokens t WHERE t.circle_id = m.circle_id AND t.revoked_at IS NULL AND t.can_pictures = 1)`;
  const rows = await query<{ circle_id: number }>(sql, [userId]);
  return rows[0]?.circle_id ?? null;
}

/**
 * Puts `input.count` pictures in the queue for a person, unless that would pass one of their limits. All of it happens in one
 * transaction with the person's account row locked, so two requests at once cannot both slip under a limit.
 */
export async function enqueue(userId: number, input: JobInput): Promise<EnqueueResult> {
  const circleId = await pictureCircleOf(userId);
  return withTransaction<EnqueueResult>(async (client) => {
    const { rows: who } = await client.query<{ image_daily_limit: number | null }>(
      "SELECT image_daily_limit FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (who.length === 0) return { ok: false, status: 401, error: "Unauthorized" };
    const limit = dailyPictureLimit(who[0].image_daily_limit);
    if (limit <= 0) return { ok: false, status: 403, error: "Making pictures is switched off for your account. Ask the person who runs this app." };

    if (input.cardId !== null) {
      const { rows } = await client.query("SELECT 1 FROM oracle_cards WHERE id = $1 AND user_id = $2", [input.cardId, userId]);
      if (rows.length === 0) return { ok: false, status: 404, error: "Card not found" };
    }

    const { rows: counts } = await client.query<{ active: number; uncollected: number }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('queued', 'running'))::int AS active,
              COUNT(*) FILTER (WHERE status IN ('queued', 'running', 'done'))::int AS uncollected
       FROM image_jobs WHERE user_id = $1`,
      [userId]
    );
    const { active, uncollected } = counts[0];
    if (active + input.count > MAX_ACTIVE_PER_USER) {
      return {
        ok: false,
        status: 429,
        error: `You can have ${MAX_ACTIVE_PER_USER} pictures waiting at a time, and ${active} ${active === 1 ? "is" : "are"} waiting now. Ask for fewer, or wait until some are made.`,
      };
    }
    if (uncollected + input.count > MAX_UNCOLLECTED_PER_USER) {
      return { ok: false, status: 429, error: `You have ${uncollected} pictures waiting or finished. Keep or discard some of them first.` };
    }

    const tooMany = { ok: false as const, status: 429, error: `That would pass your ${limit} pictures for today. They come back at midnight.` };
    if (input.count > limit) return tooMany;
    const tz = quotaTimeZone();
    const { rows: day } = await client.query<{ pictures: number }>(
      `INSERT INTO ai_usage (user_id, day, calls, pictures) VALUES ($1, (NOW() AT TIME ZONE $4)::date, 0, $2)
       ON CONFLICT (user_id, day) DO UPDATE SET pictures = ai_usage.pictures + $2 WHERE ai_usage.pictures + $2 <= $3
       RETURNING pictures`,
      [userId, input.count, limit, tz]
    );
    if (day.length === 0) return tooMany;

    const ids: number[] = [];
    for (let i = 0; i < input.count; i++) {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO image_jobs (user_id, card_id, prompt, form, circle_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [userId, input.cardId, input.prompt, input.form, circleId]
      );
      ids.push(Number(rows[0].id));
    }
    console.info(`[image-queue] user ${userId} asked for ${input.count} picture(s): ${day[0].pictures} of ${limit} today`);
    return { ok: true, ids, circleId };
  });
}

export interface JobView {
  id: number;
  card_id: number | null;
  status: JobStatus;
  error: string | null;
  prompt: string;
  /** How many pictures are waiting or being made ahead of this one (for a waiting picture). */
  ahead: number;
  created_at: string;
}

/** A person's pictures that are waiting, being made, finished, or failed (not yet cleared), oldest first. */
export async function listJobs(userId: number, cardId?: number | null): Promise<JobView[]> {
  const rows = await query<JobView & { id: string; ahead: string }>(
    `SELECT j.id, j.card_id, j.status, j.error, j.prompt, j.created_at,
            CASE WHEN j.status IN ('queued', 'running')
                 THEN (SELECT COUNT(*) FROM image_jobs o WHERE o.status IN ('queued', 'running') AND o.id < j.id AND o.circle_id IS NOT DISTINCT FROM j.circle_id) ELSE 0 END AS ahead
     FROM image_jobs j
     WHERE j.user_id = $1 AND j.status <> 'cancelled' AND ($2::int IS NULL OR j.card_id = $2)
     ORDER BY j.id`,
    [userId, cardId ?? null]
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), ahead: Number(r.ahead) }));
}

/** Stops a waiting or running picture (it is not charged to the day), or clears a finished or failed one. Returns false if it is not theirs. */
export async function removeJob(userId: number, id: number): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ status: JobStatus }>("SELECT status FROM image_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE", [id, userId]);
    if (rows.length === 0) return false;
    const status = rows[0].status;
    if (status === "queued" || status === "running") {
      // The picture is still wanted by nobody. A running one is left to finish; the worker throws its result away.
      await client.query("UPDATE image_jobs SET status = 'cancelled', result = NULL, finished_at = NOW() WHERE id = $1", [id]);
      if (status === "queued") await refundPicture(client, userId);
    } else {
      await client.query("DELETE FROM image_jobs WHERE id = $1", [id]);
    }
    return true;
  });
}

type Client = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

async function refundPicture(client: Client, userId: number): Promise<void> {
  await client.query(
    "UPDATE ai_usage SET pictures = GREATEST(pictures - 1, 0) WHERE user_id = $1 AND day = (NOW() AT TIME ZONE $2)::date",
    [userId, quotaTimeZone()]
  );
}

/** The bytes of a finished picture, or null. */
export async function jobImage(userId: number, id: number): Promise<{ bytes: Buffer; mime: string } | null> {
  const row = await queryOne<{ result: Buffer | null; result_mime: string | null }>(
    "SELECT result, result_mime FROM image_jobs WHERE id = $1 AND user_id = $2 AND status = 'done'",
    [id, userId]
  );
  return row?.result && row.result_mime ? { bytes: row.result, mime: row.result_mime } : null;
}

/** Gives up on jobs that have waited too long and deletes old finished ones, so the table stays small. */
export async function sweepJobs(): Promise<void> {
  await query(
    `UPDATE image_jobs SET status = 'failed', finished_at = NOW(),
            error = 'The picture studio was not awake in time. Try again later.'
     WHERE status = 'queued' AND created_at < NOW() - make_interval(hours => $1)`,
    [JOB_LIFETIME_HOURS]
  );
  await query(
    `DELETE FROM image_jobs WHERE status IN ('done', 'failed', 'cancelled') AND finished_at < NOW() - make_interval(hours => $1)`,
    [JOB_LIFETIME_HOURS]
  );
}

// --- For the worker ---

export interface ClaimedJob {
  id: number;
  user_id: number;
  prompt: string;
  form: string;
}

/**
 * Takes the next waiting picture. People take turns: a person's first waiting picture goes before anyone's second, a picture
 * already being made counts as a turn, and among equals the person served longest ago goes first. Null when nothing is waiting.
 * A worker takes only its own queue: the app's studio (`circleId` null) the pictures of people with no circle computer, a circle's computer
 * only its own circle's.
 */
export async function claimNext(workerId: number | null = null, circleId: number | null = null): Promise<ClaimedJob | null> {
  const row = await queryOne<ClaimedJob & { id: string }>(
    `UPDATE image_jobs SET status = 'running', started_at = NOW(), worker_id = $1
     WHERE id = (
       SELECT q.id FROM (
         SELECT j.id, j.user_id, j.created_at,
                ROW_NUMBER() OVER (PARTITION BY j.user_id ORDER BY j.created_at, j.id)
                  + (SELECT COUNT(*) FROM image_jobs r WHERE r.user_id = j.user_id AND r.status = 'running') AS turn
         FROM image_jobs j WHERE j.status = 'queued' AND j.circle_id IS NOT DISTINCT FROM $2::int
       ) q
       ORDER BY q.turn, (SELECT MAX(s.started_at) FROM image_jobs s WHERE s.user_id = q.user_id) NULLS FIRST, q.created_at, q.id
       LIMIT 1)
       AND status = 'queued'
     RETURNING id, user_id, prompt, form`,
    [workerId, circleId]
  );
  return row ? { ...row, id: Number(row.id) } : null;
}

/**
 * Saves a finished picture. False when the person cancelled it meanwhile (the picture is thrown away), or when `workerId` is given and the job
 * is not that worker's.
 */
export async function finishJob(id: number, bytes: Buffer, mime: string, workerId: number | null = null): Promise<boolean> {
  const rows = await query(
    `UPDATE image_jobs SET status = 'done', result = $2, result_mime = $3, finished_at = NOW()
     WHERE id = $1 AND status = 'running' AND ($4::int IS NULL OR worker_id = $4) RETURNING id`,
    [id, bytes, mime, workerId]
  );
  return rows.length > 0;
}

/** Marks a picture as failed with words the person can read, and gives the day's count back to its owner. Only the claiming worker's job when `workerId` is given. */
export async function failJob(id: number, error: string, workerId: number | null = null): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ user_id: number }>(
      `UPDATE image_jobs SET status = 'failed', error = $2, finished_at = NOW()
       WHERE id = $1 AND status = 'running' AND ($3::int IS NULL OR worker_id = $3) RETURNING user_id`,
      [id, error.slice(0, 500), workerId]
    );
    if (rows.length > 0) await refundPicture(client, rows[0].user_id);
    return rows.length > 0;
  });
}

/**
 * Gives up on a circle's waiting pictures with words the person can read, and gives their day's count back: all of the circle's (its computer is
 * gone), or one person's (they left, or stopped using it). A picture already being made is left to finish. Returns how many were given up.
 */
export async function dropWaitingCircleJobs(circleId: number, userId: number | null, why: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `WITH gone AS (
       UPDATE image_jobs SET status = 'failed', error = $3, finished_at = NOW()
       WHERE circle_id = $1 AND status = 'queued' AND ($2::int IS NULL OR user_id = $2) RETURNING user_id
     ), refunded AS (
       UPDATE ai_usage u SET pictures = GREATEST(u.pictures - g.n, 0)
       FROM (SELECT user_id, COUNT(*)::int AS n FROM gone GROUP BY user_id) g
       WHERE u.user_id = g.user_id AND u.day = (NOW() AT TIME ZONE $4)::date RETURNING u.user_id
     )
     SELECT COUNT(*)::int AS n FROM gone`,
    [circleId, userId, why.slice(0, 500), quotaTimeZone()]
  );
  return rows[0]?.n ?? 0;
}

/**
 * After a worker starts: pictures it left "running" in an earlier run that stopped go back to the front of the line. With `workerId`, only
 * that worker's own (and any claimed before workers had tokens), so one studio starting never takes work away from another one.
 */
export async function requeueStale(workerId: number | null = null): Promise<number> {
  const rows = await query(
    `UPDATE image_jobs SET status = 'queued', started_at = NULL, worker_id = NULL
     WHERE status = 'running' AND ($1::int IS NULL OR worker_id = $1 OR worker_id IS NULL) RETURNING id`,
    [workerId]
  );
  return rows.length;
}
