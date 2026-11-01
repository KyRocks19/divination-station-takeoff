import { createHash, randomInt } from "crypto";
import { query, queryOne } from "./db";

// Single-use invite codes: the owner makes one, the person it is for makes their own account with it at /join. Only a hash is stored.

export const INVITE_DAYS = 14;
/** The most unused, unexpired codes that can exist at once, so a slip cannot fill the table. */
export const MAX_OPEN_INVITES = 50;
export const MAX_NOTE = 100;
// No 0, O, 1, I, or L: a code read aloud or copied by hand is not mistaken.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A new code such as K7QM-2XPD-9TWR (twelve characters of a 31-letter alphabet, so about 59 bits). */
export function makeCode(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-");
}

/** What was typed, reduced to letters and digits in capitals, so spaces, dashes, and small letters do not matter. */
export function normalizeCode(input: unknown): string {
  return typeof input === "string" ? input.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export const looksLikeCode = (normalized: string) => normalized.length === 12;

export function hashCode(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

export type InviteStatus = "waiting" | "used" | "expired" | "revoked";

export function inviteStatus(row: { used_at: string | null; revoked_at: string | null; expires_at: string }, now = new Date()): InviteStatus {
  if (row.used_at) return "used";
  if (row.revoked_at) return "revoked";
  return new Date(row.expires_at) <= now ? "expired" : "waiting";
}

export interface InviteRow {
  id: number;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  used_by_username: string | null;
}

export async function listInvites(): Promise<(InviteRow & { status: InviteStatus })[]> {
  const rows = await query<InviteRow>(
    `SELECT i.id, i.note, i.created_at, i.expires_at, i.used_at, i.revoked_at, u.username AS used_by_username
     FROM invite_codes i LEFT JOIN users u ON u.id = i.used_by
     ORDER BY i.created_at DESC, i.id DESC LIMIT 100`
  );
  return rows.map((r) => ({ ...r, status: inviteStatus(r) }));
}

/** Makes a code and returns it. This is the only time it exists in readable form. Null when too many are already waiting. */
export async function createInvite(adminId: number, note: string | null): Promise<{ id: number; code: string; expires_at: string } | null> {
  const open = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM invite_codes WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()");
  if ((open?.n ?? 0) >= MAX_OPEN_INVITES) return null;
  const code = makeCode();
  const row = await queryOne<{ id: number; expires_at: string }>(
    `INSERT INTO invite_codes (code_hash, note, created_by, expires_at) VALUES ($1, $2, $3, NOW() + make_interval(days => $4)) RETURNING id, expires_at`,
    [hashCode(normalizeCode(code)), note, adminId, INVITE_DAYS]
  );
  return { id: row!.id, code, expires_at: row!.expires_at };
}

/** Stops an unused code from working. False when there was nothing to revoke (already used, revoked, or not there). */
export async function revokeInvite(id: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>("UPDATE invite_codes SET revoked_at = NOW() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL RETURNING id", [id]);
  return !!row;
}

/** Uses a code up if it is real, unused, not revoked, and not expired; returns its id. One request wins if two arrive together. */
export async function claimInvite(normalized: string): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    "UPDATE invite_codes SET used_at = NOW() WHERE code_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() RETURNING id",
    [hashCode(normalized)]
  );
  return row?.id ?? null;
}

/** Gives a claimed code back (the account could not be made after all). */
export async function releaseInvite(id: number): Promise<void> {
  await query("UPDATE invite_codes SET used_at = NULL, used_by = NULL WHERE id = $1", [id]);
}

export async function recordInviteUse(id: number, userId: number): Promise<void> {
  await query("UPDATE invite_codes SET used_by = $2 WHERE id = $1", [id, userId]);
}

// --- What a person may choose when they join ---

export const MIN_PASSWORD = 12;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,40}$/;

/** A plain sentence saying what is wrong with the chosen name or password, or null when both are fine. */
export function joinProblem(username: unknown, password: unknown, displayName: unknown): string | null {
  if (typeof username !== "string" || !USERNAME_RE.test(username.trim())) {
    return "Choose a username of 3 to 40 letters, digits, dots, dashes, or underscores.";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return `Choose a password of at least ${MIN_PASSWORD} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (displayName !== undefined && displayName !== null && (typeof displayName !== "string" || displayName.length > 60)) return "A display name can be 60 characters at most.";
  return null;
}
