import { query, queryOne } from "./db";

// Notes from the people using the app to the person who runs it (migration 043).

import { KINDS, MAX_MESSAGE, MAX_REPLY, STATUSES, type FeedbackKind, type FeedbackStatus } from "./feedback-shared";
export { KIND_LABELS, KINDS, MAX_MESSAGE, MAX_REPLY, STATUSES } from "./feedback-shared";
export type { FeedbackKind, FeedbackStatus } from "./feedback-shared";

/** Notes one person can send in a day, so a stuck button cannot fill the table. */
export const MAX_PER_DAY = 20;

/** The path of a page ("/oracle/cards/12"), without any query or fragment, or null. Only the path is kept, never the words on the page. */
export function cleanPage(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  return value.split(/[?#]/)[0].slice(0, 300) || null;
}

/** A short description of the device, from what the browser reports, or null. */
export function cleanDevice(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, 300) : null;
}

export function cleanFeedback(
  body: unknown
): { ok: true; input: { kind: FeedbackKind; message: string; page: string | null; device: string | null } } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = KINDS.find((k) => k === b.kind);
  if (!kind) return { ok: false, error: "kind must be bug, idea, confusing, or other" };
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message) return { ok: false, error: "Write a few words first." };
  if (message.length > MAX_MESSAGE) return { ok: false, error: `That is too long (${MAX_MESSAGE} characters at most).` };
  return { ok: true, input: { kind, message, page: cleanPage(b.page), device: cleanDevice(b.device) } };
}

export interface FeedbackRow {
  id: number;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  device: string | null;
  status: FeedbackStatus;
  reply: string | null;
  created_at: string;
  /** Only in the owner's view of everyone's notes. */
  username?: string;
}

export async function addFeedback(
  userId: number,
  input: { kind: FeedbackKind; message: string; page: string | null; device: string | null }
): Promise<{ ok: true; id: number } | { ok: false; status: number; error: string }> {
  const today = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM feedback WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'",
    [userId]
  );
  if ((today?.n ?? 0) >= MAX_PER_DAY) return { ok: false, status: 429, error: "That is plenty for today. Thank you. Try again tomorrow." };
  const row = await queryOne<{ id: string }>(
    "INSERT INTO feedback (user_id, kind, message, page, device) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [userId, input.kind, input.message, input.page, input.device]
  );
  return { ok: true, id: Number(row!.id) };
}

/** A person's own notes, newest first. */
export async function listOwn(userId: number): Promise<FeedbackRow[]> {
  const rows = await query<FeedbackRow & { id: string }>(
    "SELECT id, kind, message, page, device, status, reply, created_at FROM feedback WHERE user_id = $1 ORDER BY id DESC LIMIT 200",
    [userId]
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

/** Everyone's notes, new ones first, for the person who runs the app. */
export async function listAll(): Promise<FeedbackRow[]> {
  const rows = await query<FeedbackRow & { id: string }>(
    `SELECT f.id, f.kind, f.message, f.page, f.device, f.status, f.reply, f.created_at, u.username
     FROM feedback f JOIN users u ON u.id = f.user_id
     ORDER BY (f.status = 'new') DESC, f.id DESC LIMIT 300`
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function countNew(): Promise<number> {
  return (await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM feedback WHERE status = 'new'"))?.n ?? 0;
}

/** The owner marks a note seen or done and/or writes a reply. A field left out is unchanged; an empty reply clears it. */
export async function review(id: number, change: { status?: unknown; reply?: unknown }): Promise<boolean | string> {
  const status = change.status === undefined ? undefined : STATUSES.find((s) => s === change.status);
  if (change.status !== undefined && !status) return "status must be new, seen, or done";
  let reply: string | null | undefined;
  if (change.reply !== undefined) {
    if (change.reply !== null && typeof change.reply !== "string") return "reply must be text";
    reply = typeof change.reply === "string" && change.reply.trim() ? change.reply.trim() : null;
    if (reply && reply.length > MAX_REPLY) return `The reply is too long (${MAX_REPLY} characters at most).`;
  }
  const rows = await query(
    `UPDATE feedback SET status = COALESCE($2, status), reply = CASE WHEN $3 THEN $4 ELSE reply END WHERE id = $1 RETURNING id`,
    [id, status ?? null, reply !== undefined, reply ?? null]
  );
  return rows.length > 0;
}

/** Deletes a note: the sender's own, or any when `admin`. */
export async function removeFeedback(id: number, userId: number, admin: boolean): Promise<boolean> {
  const rows = await query("DELETE FROM feedback WHERE id = $1 AND ($3 OR user_id = $2) RETURNING id", [id, userId, admin]);
  return rows.length > 0;
}
