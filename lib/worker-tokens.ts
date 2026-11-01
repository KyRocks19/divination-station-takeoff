import { createHash, randomBytes } from "crypto";
import { query, queryOne, withTransaction } from "./db";
import { TOKEN_PREFIX, bearerToken } from "./worker-protocol";
import { dropWaitingCircleJobs } from "./image-queue";
import { familyCircleAllowed } from "./family-access-core";

// Tokens for picture computers (migration 062). An admin makes one on /admin/workers and puts it in the studio's settings; the studio then talks
// to the website's worker API (app/api/worker/**) with it instead of holding the database password. Only a hash is kept. A token can only take
// jobs from the queue and send back their results, and only the kinds it was made for.

export const MAX_NAME = 60;
/** The most tokens that can be in use at once, so a slip cannot fill the table. The app's own (admin) tokens only; a circle has a smaller number of its own. */
export const MAX_ACTIVE_TOKENS = 20;
/** The most picture computers one circle can have at once. */
export const MAX_CIRCLE_TOKENS = 3;

export type WorkerKind = "pictures" | "companion";

export interface Worker {
  id: number;
  name: string;
  pictures: boolean;
  companion: boolean;
  /** The circle this computer belongs to (it then takes only that circle's pictures), or null for the app's own. */
  circleId: number | null;
}

/** A new token: dsw_ and 32 random bytes in base64url (43 characters). */
export function makeWorkerToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/** The hash stored for a token. A token is 256 random bits, so a plain SHA-256 is enough (there is nothing to guess, unlike a password). */
export function hashWorkerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Checks a token's name and the kinds it may take. */
export function cleanTokenInput(body: unknown): { ok: true; name: string; pictures: boolean; companion: boolean } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Give the computer a name, such as whose it is." };
  if (name.length > MAX_NAME) return { ok: false, error: `The name can be ${MAX_NAME} characters at most.` };
  const pictures = b.pictures !== false;
  const companion = b.companion === true;
  if (!pictures && !companion) return { ok: false, error: "Choose at least one thing this computer may do." };
  return { ok: true, name, pictures, companion };
}

/**
 * The worker a request comes from, by its "Authorization: Bearer dsw_..." header, or null when there is no such token or it was revoked.
 * Notes when it was last used, for the admin page.
 */
export async function findWorker(authorization: string | null): Promise<Worker | null> {
  const token = bearerToken(authorization);
  if (!token) return null;
  const row = await queryOne<{ id: number; name: string; can_pictures: number; can_companion: number; circle_id: number | null }>(
    `UPDATE worker_tokens SET last_used_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id, name, can_pictures, can_companion, circle_id`,
    [hashWorkerToken(token)]
  );
  return row ? { id: row.id, name: row.name, pictures: row.can_pictures === 1, companion: row.can_companion === 1, circleId: row.circle_id } : null;
}

/**
 * For a worker route: the worker, or the refusal to send back (401 for no token or a revoked one, 403 when this token may not take that kind).
 * Every handler under app/api/worker/ starts with this.
 */
export async function requireWorker(request: { headers: Headers }, kind?: WorkerKind): Promise<Worker | Response> {
  const worker = await findWorker(request.headers.get("authorization"));
  if (!worker) return Response.json({ error: "Unauthorized: this studio's token is missing, mistyped, or revoked." }, { status: 401 });
  if (!familyCircleAllowed(worker.circleId)) return Response.json({ error: "This studio is not linked to the family circle." }, { status: 403 });
  if (kind && !worker[kind]) {
    return Response.json({ error: `This token is not allowed to take ${kind === "pictures" ? "pictures" : "companion requests"}.` }, { status: 403 });
  }
  return worker;
}

export interface TokenRow {
  id: number;
  name: string;
  can_pictures: number;
  can_companion: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  /** The circle's name for a circle's computer, otherwise null. */
  circle_name: string | null;
}

/** Every token, the app's own and the circles', for the admin page. Never the tokens themselves. */
export async function listWorkerTokens(): Promise<TokenRow[]> {
  return query<TokenRow>(
    `SELECT t.id, t.name, t.can_pictures, t.can_companion, t.created_at, t.last_used_at, t.revoked_at, c.name AS circle_name
     FROM worker_tokens t LEFT JOIN circles c ON c.id = t.circle_id
     ORDER BY t.revoked_at IS NOT NULL, t.created_at DESC, t.id DESC LIMIT 100`
  );
}

/** A circle's picture computers, for the circle's owner: names and when each was last used, never the tokens. */
export async function listCircleTokens(circleId: number): Promise<{ id: number; name: string; created_at: string; last_used_at: string | null }[]> {
  return query(
    `SELECT id, name, created_at, last_used_at FROM worker_tokens
     WHERE circle_id = $1 AND revoked_at IS NULL ORDER BY created_at, id`,
    [circleId]
  );
}

/** Makes a token and returns it. This is the only time it exists in readable form. Null when too many are in use. */
export async function createWorkerToken(adminId: number, input: { name: string; pictures: boolean; companion: boolean }): Promise<{ id: number; token: string } | null> {
  const open = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM worker_tokens WHERE revoked_at IS NULL AND circle_id IS NULL");
  if ((open?.n ?? 0) >= MAX_ACTIVE_TOKENS) return null;
  const token = makeWorkerToken();
  const row = await queryOne<{ id: number }>(
    "INSERT INTO worker_tokens (token_hash, name, can_pictures, can_companion, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [hashWorkerToken(token), input.name, input.pictures ? 1 : 0, input.companion ? 1 : 0, adminId]
  );
  return { id: row!.id, token };
}

/**
 * Makes a token for a circle's own picture computer (pictures only; the circle's members' pictures go to it). The reply holds the readable token,
 * which cannot be shown again. Null when the circle already has MAX_CIRCLE_TOKENS in use. The caller has checked that `ownerId` runs the circle.
 */
export async function createCircleWorkerToken(ownerId: number, circleId: number, name: string): Promise<{ id: number; token: string } | null> {
  const open = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM worker_tokens WHERE revoked_at IS NULL AND circle_id = $1", [circleId]);
  if ((open?.n ?? 0) >= MAX_CIRCLE_TOKENS) return null;
  const token = makeWorkerToken();
  const row = await queryOne<{ id: number }>(
    "INSERT INTO worker_tokens (token_hash, name, can_pictures, can_companion, created_by, circle_id) VALUES ($1, $2, 1, 0, $3, $4) RETURNING id",
    [hashWorkerToken(token), name, ownerId, circleId]
  );
  return { id: row!.id, token };
}

/** A circle's computer name as typed: tidied, 1 to MAX_NAME characters; otherwise null. */
export function cleanComputerName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= MAX_NAME ? name : null;
}

/**
 * Revokes a token, so it stops working at once, and puts the pictures and requests it was working on back in the queue. False when it is not there or already revoked.
 * With `circleId`, only a token of that circle (a circle's owner revoking their own computer). When that was the circle's last computer, the circle's
 * waiting pictures are given up with a plain sentence, because nothing will make them.
 */
export async function revokeWorkerToken(id: number, circleId?: number): Promise<boolean> {
  const revoked = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "UPDATE worker_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL AND ($2::int IS NULL OR circle_id = $2) RETURNING id, circle_id",
      [id, circleId ?? null]
    );
    if (rows.length === 0) return null;
    await client.query("UPDATE image_jobs SET status = 'queued', started_at = NULL, worker_id = NULL WHERE worker_id = $1 AND status = 'running'", [id]);
    await client.query("UPDATE companion_jobs SET status = 'queued', started_at = NULL, worker_id = NULL WHERE worker_id = $1 AND status = 'running'", [id]);
    return { circleId: rows[0].circle_id as number | null };
  });
  if (revoked === null) return false;
  if (revoked.circleId !== null) await dropWaitingPicturesIfNoComputer(revoked.circleId);
  return true;
}

/** After a circle's computer is revoked: if it was the last one, nothing will make the circle's waiting pictures, so say so now rather than in 24 hours. */
async function dropWaitingPicturesIfNoComputer(circleId: number): Promise<void> {
  const left = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM worker_tokens WHERE circle_id = $1 AND revoked_at IS NULL AND can_pictures = 1", [circleId]);
  if ((left?.n ?? 0) === 0) await dropWaitingCircleJobs(circleId, null, "This circle's picture computer was removed, so this picture will not be made. Ask again to use the app's own.");
}

/** Takes away all of a circle's picture computers (the circle is handed to someone else, or its owner's account is going). Their waiting pictures are given up. */
export async function revokeAllCircleTokens(circleId: number): Promise<void> {
  const ids = await query<{ id: number }>("SELECT id FROM worker_tokens WHERE circle_id = $1 AND revoked_at IS NULL", [circleId]);
  for (const t of ids) await revokeWorkerToken(t.id, circleId);
}
