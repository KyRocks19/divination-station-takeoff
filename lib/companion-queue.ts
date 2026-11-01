import { query, queryOne, withTransaction } from "./db";
import { quotaTimeZone } from "./ai-quota";
import { buildContextFor, type Subject } from "./companion-subject";
import { isToolKind } from "./companion-context-tools";
import type { CompanionMode } from "./companion-modes";
import { focusInstructions } from "./companion-focus";
import { parsePatternRef } from "./companion-pattern";
import { runCompanion, type AskModel, type CompanionOutcome } from "./companion-run";
import type { CompanionStep, ModelCall } from "./worker-protocol";

// The queue of requests for the AI companion (migrations 047 and 048), shaped like the picture queue (lib/image-queue.ts). Used by the
// website's routes, by a server that can reach the model itself, and by the worker API (app/api/worker/companion/**) that the studio on the
// owner's computer (scripts/image-worker.ts) talks to. The studio only runs the model; every check stays here (stepCompanionJob).

export const DEFAULT_COMPANION_DAILY = 30;
/** A person's requests waiting or being answered at one time. */
export const MAX_ACTIVE_PER_USER = 1;
/** Waiting, being answered, or answered and not yet kept or discarded. */
export const MAX_STORED_PER_USER = 5;
/** An answer is kept this long for the person to Keep or Discard it; a request still waiting after this long is given up. */
export const COMPANION_LIFETIME_HOURS = 24;
/** The most answers the person can keep for one reading. */
export const MAX_NOTES_PER_READING = 30;

export function companionDailyLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = env.COMPANION_DAILY_LIMIT;
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isInteger(n) && n >= 0 ? n : DEFAULT_COMPANION_DAILY;
}

export type { JobStatus, JobView, NoteView } from "./companion-queue-types";
import type { JobStatus, JobView, NoteView } from "./companion-queue-types";

export type EnqueueResult = { ok: true; id: number } | { ok: false; status: number; error: string };

/**
 * Puts a request in the queue unless it would pass one of the person's limits. One transaction with their account row locked, so two requests at
 * once cannot both slip under a limit. The subject must be the person's own: an oracle pull or a reading with one of the other tools (for questions,
 * what has changed, and a reading), or one of their oracle items (for picture ideas).
 */
export async function enqueueCompanion(userId: number, subject: Subject, mode: CompanionMode, acknowledged: boolean): Promise<EnqueueResult> {
  return withTransaction<EnqueueResult>(async (client) => {
    const { rows: who } = await client.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (who.length === 0) return { ok: false, status: 401, error: "Unauthorized" };
    if (mode === "changes") return { ok: false, status: 400, error: "That does not use the companion." };
    if (subject.pattern !== undefined) {
      if (mode !== "pattern") return { ok: false, status: 400, error: "A pattern is asked about with a question." };
      if (!parsePatternRef(subject.pattern)) return { ok: false, status: 400, error: "That is not a pattern I know." };
    } else if (mode === "pattern") {
      return { ok: false, status: 400, error: "A question about a pattern names the pattern." };
    } else if (subject.self) {
      if (mode !== "noticed") return { ok: false, status: 400, error: "That is asked about a reading or an item." };
    } else if (mode === "noticed") {
      return { ok: false, status: 400, error: "A suggested line is about you, not a reading." };
    } else if (subject.cardId !== undefined) {
      if (mode !== "scene") return { ok: false, status: 400, error: "That can only be asked about a reading." };
      const { rows } = await client.query("SELECT 1 FROM oracle_cards WHERE id = $1 AND user_id = $2", [subject.cardId, userId]);
      if (rows.length === 0) return { ok: false, status: 404, error: "Not found" };
    } else {
      if (mode === "scene") return { ok: false, status: 400, error: "Picture ideas are asked about an item, not a reading." };
      const { rows } = await client.query<{ kind: string }>("SELECT kind FROM divinations WHERE id = $1 AND user_id = $2", [subject.divinationId, userId]);
      if (rows.length === 0) return { ok: false, status: 404, error: "Not found" };
      if (rows[0].kind !== "oracle" && !isToolKind(rows[0].kind)) return { ok: false, status: 400, error: "The companion cannot answer about this kind of reading yet." };
    }

    const limit = companionDailyLimit();
    if (limit <= 0) return { ok: false, status: 403, error: "The companion is switched off for your account. Ask the person who runs this app." };

    const { rows: counts } = await client.query<{ active: number; stored: number }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('queued', 'running'))::int AS active,
              COUNT(*) FILTER (WHERE status IN ('queued', 'running', 'done'))::int AS stored
       FROM companion_jobs WHERE user_id = $1`,
      [userId]
    );
    const { active, stored } = counts[0];
    if (active >= MAX_ACTIVE_PER_USER) return { ok: false, status: 429, error: "Your companion is still working on your last request. Wait for it, or cancel it." };
    if (stored >= MAX_STORED_PER_USER) return { ok: false, status: 429, error: `You have ${stored} answers waiting. Keep or discard some of them first.` };

    const tooMany = { ok: false as const, status: 429, error: `You have used your ${limit} companion requests for today. They come back at midnight.` };
    const { rows: day } = await client.query<{ companion: number }>(
      `INSERT INTO ai_usage (user_id, day, calls, companion) VALUES ($1, (NOW() AT TIME ZONE $3)::date, 0, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET companion = ai_usage.companion + 1 WHERE ai_usage.companion < $2
       RETURNING companion`,
      [userId, limit, quotaTimeZone()]
    );
    if (day.length === 0) return tooMany;

    const { rows } =
      subject.pattern !== undefined
        ? await client.query<{ id: string }>("INSERT INTO companion_jobs (user_id, mode, acknowledged, pattern_ref) VALUES ($1, $2, $3, $4) RETURNING id", [userId, mode, acknowledged ? 1 : 0, subject.pattern])
        : await client.query<{ id: string }>(
            "INSERT INTO companion_jobs (user_id, divination_id, card_id, mode, acknowledged) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [userId, subject.divinationId ?? null, subject.cardId ?? null, mode, acknowledged ? 1 : 0]
          );
    console.info(`[companion] user ${userId} asked (${mode}): ${day[0].companion} of ${limit} today`);
    return { ok: true, id: Number(rows[0].id) };
  });
}

/**
 * Stores an answer that was built in code ("what has changed"), so it appears like any other and can be kept or discarded. It uses no model and
 * does not count against the day; it counts toward the answers waiting. `divinationId` must already be known to be the person's own.
 */
export async function storeFinishedCompanion(userId: number, divinationId: number, mode: CompanionMode, text: string): Promise<EnqueueResult> {
  return withTransaction<EnqueueResult>(async (client) => {
    const { rows: who } = await client.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (who.length === 0) return { ok: false, status: 401, error: "Unauthorized" };
    const { rows: counts } = await client.query<{ stored: number }>("SELECT COUNT(*) FILTER (WHERE status IN ('queued', 'running', 'done'))::int AS stored FROM companion_jobs WHERE user_id = $1", [userId]);
    if (counts[0].stored >= MAX_STORED_PER_USER) return { ok: false, status: 429, error: `You have ${counts[0].stored} answers waiting. Keep or discard some of them first.` };
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO companion_jobs (user_id, divination_id, mode, status, action, result, finished_at) VALUES ($1, $2, $3, 'done', 'reply', $4, NOW()) RETURNING id",
      [userId, divinationId, mode, text.slice(0, 5990)]
    );
    return { ok: true, id: Number(rows[0].id) };
  });
}

type Client = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

async function refund(client: Client, userId: number): Promise<void> {
  await client.query("UPDATE ai_usage SET companion = GREATEST(companion - 1, 0) WHERE user_id = $1 AND day = (NOW() AT TIME ZONE $2)::date", [userId, quotaTimeZone()]);
}

/** A person's requests for one reading or item that are waiting, answered, or failed (not yet cleared), and the answers they have kept. */
export async function listForSubject(userId: number, subject: Subject): Promise<{ jobs: JobView[]; notes: NoteView[] }> {
  const rows = await query<JobView & { id: string; ahead: string }>(
    `SELECT j.id, j.mode, j.status, j.action, j.result, j.error, j.created_at,
            CASE WHEN j.status IN ('queued', 'running')
                 THEN (SELECT COUNT(*) FROM companion_jobs o WHERE o.status IN ('queued', 'running') AND o.id < j.id) ELSE 0 END AS ahead
     FROM companion_jobs j
     WHERE j.user_id = $1 AND j.status <> 'cancelled' AND (($2::int IS NOT NULL AND j.divination_id = $2) OR ($3::int IS NOT NULL AND j.card_id = $3) OR ($4::boolean AND j.mode = 'noticed'))
     ORDER BY j.id`,
    [userId, subject.divinationId ?? null, subject.cardId ?? null, subject.self === true]
  );
  const notes =
    subject.divinationId !== undefined
      ? await query<NoteView>(
          "SELECT id, mode, companion_name, content, created_at FROM companion_notes WHERE user_id = $1 AND divination_id = $2 ORDER BY created_at, id",
          [userId, subject.divinationId]
        )
      : [];
  return { jobs: rows.map((r) => ({ ...r, id: Number(r.id), ahead: Number(r.ahead) })), notes };
}

/** The person's requests about patterns (waiting, answered, or failed and not yet cleared). */
export async function listPatternJobs(userId: number): Promise<JobView[]> {
  const rows = await query<JobView & { id: string; ahead: string }>(
    `SELECT j.id, j.mode, j.status, j.action, j.result, j.error, j.created_at, j.pattern_ref,
            CASE WHEN j.status IN ('queued', 'running')
                 THEN (SELECT COUNT(*) FROM companion_jobs o WHERE o.status IN ('queued', 'running') AND o.id < j.id) ELSE 0 END AS ahead
       FROM companion_jobs j WHERE j.user_id = $1 AND j.mode = 'pattern' AND j.status <> 'cancelled' ORDER BY j.id`,
    [userId]
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), ahead: Number(r.ahead) }));
}

/** Stops a waiting request (it is not counted against the day) or clears an answered or failed one. False when it is not theirs. */
export async function removeCompanionJob(userId: number, id: number): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ status: JobStatus }>("SELECT status FROM companion_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE", [id, userId]);
    if (rows.length === 0) return false;
    const status = rows[0].status;
    if (status === "queued" || status === "running") {
      await client.query("UPDATE companion_jobs SET status = 'cancelled', result = NULL, finished_at = NOW() WHERE id = $1", [id]);
      if (status === "queued") await refund(client, userId);
    } else {
      await client.query("DELETE FROM companion_jobs WHERE id = $1", [id]);
    }
    return true;
  });
}

/** Keeps an answer (questions, what has changed, or a reading): it becomes a kept note and the answer is cleared. Null when there is nothing to keep. */
export async function keepCompanionJob(userId: number, id: number): Promise<NoteView | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ divination_id: number; result: string; mode: CompanionMode }>(
      `SELECT divination_id, result, mode FROM companion_jobs
       WHERE id = $1 AND user_id = $2 AND status = 'done' AND action IN ('questions', 'reply') AND mode <> 'scene' AND divination_id IS NOT NULL AND result IS NOT NULL FOR UPDATE`,
      [id, userId]
    );
    if (rows.length === 0) return null;
    const { rows: count } = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM companion_notes WHERE user_id = $1 AND divination_id = $2", [userId, rows[0].divination_id]);
    if (count[0].n >= MAX_NOTES_PER_READING) return null;
    const { rows: name } = await client.query<{ companion_name: string | null }>("SELECT companion_name FROM users WHERE id = $1", [userId]);
    const { rows: note } = await client.query<NoteView>(
      "INSERT INTO companion_notes (user_id, divination_id, companion_name, content, mode) VALUES ($1, $2, $3, $4, $5) RETURNING id, mode, companion_name, content, created_at",
      [userId, rows[0].divination_id, name[0]?.companion_name?.trim() || "Companion", rows[0].result, rows[0].mode]
    );
    await client.query("DELETE FROM companion_jobs WHERE id = $1", [id]);
    return note[0];
  });
}

export async function deleteNote(userId: number, id: number): Promise<boolean> {
  return (await query("DELETE FROM companion_notes WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId])).length > 0;
}

/** Gives up on requests that have waited too long and deletes old answered ones, so the table stays small. */
export async function sweepCompanionJobs(): Promise<void> {
  await query(
    `UPDATE companion_jobs SET status = 'failed', finished_at = NOW(), error = 'The companion was not awake in time. Try again later.'
     WHERE status = 'queued' AND created_at < NOW() - make_interval(hours => $1)`,
    [COMPANION_LIFETIME_HOURS]
  );
  await query(
    `DELETE FROM companion_jobs WHERE status IN ('done', 'failed', 'cancelled') AND finished_at < NOW() - make_interval(hours => $1)`,
    [COMPANION_LIFETIME_HOURS]
  );
}

// --- For the studio, and for a server that can reach the model itself ---

export interface ClaimedCompanionJob {
  id: number;
  user_id: number;
  divination_id: number | null;
  card_id: number | null;
  mode: CompanionMode;
  acknowledged: boolean;
  name: string;
}

const CLAIM_RETURNING = `RETURNING id, user_id, divination_id, card_id, mode, acknowledged = 1 AS acknowledged,
  COALESCE((SELECT NULLIF(TRIM(companion_name), '') FROM users WHERE users.id = companion_jobs.user_id), 'Companion') AS name`;

/** What the person asked the companion to focus on, with their own note, as instructions ("" for none). */
async function loadFocus(userId: number): Promise<string> {
  type Row = { companion_focus: string | null; companion_focus_line: string | null; companion_note: string | null };
  const row = await queryOne<Row>("SELECT companion_focus, companion_focus_line, companion_note FROM users WHERE id = $1", [userId]);
  return focusInstructions(row?.companion_focus, row?.companion_focus_line, row?.companion_note);
}

/** Takes the oldest waiting request (each person has at most one) for a worker (`workerId`, migration 062). Null when nothing is waiting. */
export async function claimNextCompanion(workerId: number | null = null): Promise<ClaimedCompanionJob | null> {
  const row = await queryOne<ClaimedCompanionJob & { id: string }>(
    `UPDATE companion_jobs SET status = 'running', started_at = NOW(), worker_id = $1
     WHERE id = (SELECT id FROM companion_jobs WHERE status = 'queued' ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
     ${CLAIM_RETURNING}`,
    [workerId]
  );
  return row ? { ...row, id: Number(row.id) } : null;
}

/** A request this worker claimed and is still answering, read again for its next step. Null when it is not this worker's or not running any more. */
export async function claimedCompanionForWorker(id: number, workerId: number): Promise<ClaimedCompanionJob | null> {
  const row = await queryOne<ClaimedCompanionJob & { id: string }>(
    `SELECT id, user_id, divination_id, card_id, mode, acknowledged = 1 AS acknowledged,
            COALESCE((SELECT NULLIF(TRIM(companion_name), '') FROM users WHERE users.id = companion_jobs.user_id), 'Companion') AS name
     FROM companion_jobs WHERE id = $1 AND worker_id = $2 AND status = 'running'`,
    [id, workerId]
  );
  return row ? { ...row, id: Number(row.id) } : null;
}

/** Takes one particular waiting request (a server that answers its own requests). Null when it is not waiting any more. */
export async function claimCompanionById(id: number): Promise<ClaimedCompanionJob | null> {
  const row = await queryOne<ClaimedCompanionJob & { id: string }>(
    `UPDATE companion_jobs SET status = 'running', started_at = NOW() WHERE id = $1 AND status = 'queued' ${CLAIM_RETURNING}`,
    [id]
  );
  return row ? { ...row, id: Number(row.id) } : null;
}

/** Saves the answer. False when the person cancelled the request meanwhile (the answer is thrown away). */
export async function finishCompanion(id: number, outcome: CompanionOutcome, model: string): Promise<boolean> {
  const rows = await query(
    "UPDATE companion_jobs SET status = 'done', action = $2, result = $3, model = $4, finished_at = NOW() WHERE id = $1 AND status = 'running' RETURNING id",
    [id, outcome.action, outcome.text, model]
  );
  return rows.length > 0;
}

/** Marks a request as failed with words the person can read, and gives the day's count back. */
export async function failCompanion(id: number, userId: number, error: string): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query("UPDATE companion_jobs SET status = 'failed', error = $2, finished_at = NOW() WHERE id = $1 AND status = 'running' RETURNING id", [id, error.slice(0, 500)]);
    if (rows.length > 0) await refund(client, userId);
  });
}

/** After a studio starts: requests it left "running" in an earlier run go back in the queue (with `workerId`, only its own and any from before tokens). */
export async function requeueStaleCompanion(workerId: number | null = null): Promise<number> {
  return (
    await query(
      `UPDATE companion_jobs SET status = 'queued', started_at = NULL, worker_id = NULL
       WHERE status = 'running' AND ($1::int IS NULL OR worker_id = $1 OR worker_id IS NULL) RETURNING id`,
      [workerId]
    )
  ).length;
}

export const COMPANION_FAILED_WORDS = "The companion's computer could not answer just now. Try again in a little while.";

/**
 * Answers one claimed request: rebuilds the person's own words from their rows, runs the companion (screen, risk check, then the answer), and
 * saves what the person is to be shown. Logs which check paused things, never any words. `ask` talks to the model.
 */
export async function processCompanionJob(job: ClaimedCompanionJob, ask: AskModel, model: string): Promise<"done" | "cancelled" | "failed"> {
  try {
    const prepared = await prepareCompanion(job);
    if (!prepared.ok) {
      await failCompanion(job.id, job.user_id, prepared.error);
      return "failed";
    }
    return await finishWithOutcome(job, await prepared.run(ask), model);
  } catch (err) {
    console.error(`[companion] job ${job.id} FAILED: ${err instanceof Error ? err.message : err}`);
    await failCompanion(job.id, job.user_id, COMPANION_FAILED_WORDS);
    return "failed";
  }
}

/** Rebuilds the person's own words for a claimed request and returns the companion's path, ready to run with a model; or why it cannot run. */
async function prepareCompanion(job: ClaimedCompanionJob): Promise<{ ok: true; run: (ask: AskModel) => Promise<CompanionOutcome> } | { ok: false; error: string }> {
  let subject: Subject;
  if (job.mode === "pattern") {
    const ref = (await queryOne<{ pattern_ref: string | null }>("SELECT pattern_ref FROM companion_jobs WHERE id = $1", [job.id]))?.pattern_ref;
    if (!ref) return { ok: false, error: "That is not there any more." };
    subject = { pattern: ref };
  } else {
    subject = job.mode === "noticed" ? { self: true } : job.card_id !== null ? { cardId: job.card_id } : { divinationId: job.divination_id! };
  }
  const context = await buildContextFor(job.user_id, subject, job.mode);
  if (!context) return { ok: false, error: "That is not there any more." };
  // Never queued (see enqueueCompanion), but a row could exist from an odd state: it needs no model, so it is simply not answered here.
  const mode = job.mode;
  if (mode === "changes") return { ok: false, error: "That does not use the companion." };
  // A suggested line is about the counts alone: the person's own note and focus are not fed back into it.
  const focus = mode === "noticed" ? "" : await loadFocus(job.user_id);
  return { ok: true, run: (ask) => runCompanion({ context: context.text, name: job.name, acknowledged: job.acknowledged, ask, mode, focus }) };
}

async function finishWithOutcome(job: ClaimedCompanionJob, outcome: CompanionOutcome, model: string): Promise<"done" | "cancelled"> {
  const kept = await finishCompanion(job.id, outcome, model);
  console.info(`[companion] job ${job.id} (user ${job.user_id}, ${job.mode}): ${outcome.action}${outcome.because ? ` because ${outcome.because}` : ""}${kept ? "" : " (cancelled meanwhile, answer thrown away)"}`);
  return kept ? "done" : "cancelled";
}

/** Thrown by the replaying model below when the path needs an answer the studio has not sent yet. */
export class NeedsModelCall extends Error {
  constructor(readonly call: ModelCall) {
    super("the next model call is the studio's to make");
  }
}

/**
 * A model that answers from the studio's answers so far, in order, and stops at the first call it has no answer for. runCompanion is pure apart
 * from the model, so running it again with the same answers takes the same path to the same next call.
 */
export function replayingModel(answers: string[]): AskModel {
  let next = 0;
  return async (messages, opts) => {
    if (next < answers.length) return answers[next++];
    throw new NeedsModelCall({ messages, maxTokens: opts.maxTokens, temperature: opts.temperature });
  };
}

/**
 * One step of a request answered by a studio through the worker API: runs the companion's whole path again on the website (the code screen,
 * the risk check, the checks on each answer) with the studio's answers so far. Returns the next model call for the studio to make, or saves the
 * result. `model` is only recorded with the answer. A studio that could not reach its model sends "failed" instead of answers.
 */
export async function stepCompanionJob(job: ClaimedCompanionJob, answers: string[] | "failed", model: string): Promise<CompanionStep> {
  if (answers === "failed") {
    console.error(`[companion] job ${job.id}: the studio could not reach its model`);
    await failCompanion(job.id, job.user_id, COMPANION_FAILED_WORDS);
    return { result: "failed" };
  }
  try {
    const prepared = await prepareCompanion(job);
    if (!prepared.ok) {
      await failCompanion(job.id, job.user_id, prepared.error);
      return { result: "failed" };
    }
    return { result: await finishWithOutcome(job, await prepared.run(replayingModel(answers)), model) };
  } catch (err) {
    if (err instanceof NeedsModelCall) return { ask: err.call };
    console.error(`[companion] job ${job.id} FAILED: ${err instanceof Error ? err.message : err}`);
    await failCompanion(job.id, job.user_id, COMPANION_FAILED_WORDS);
    return { result: "failed" };
  }
}
