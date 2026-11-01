import { maxCircleMembers } from "./circle-limits";
import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "./db";
import { hashCode, makeCode, normalizeCode } from "./invites";
import { quotaTimeZone } from "./ai-quota";
import { masterKey } from "./secret-box";
import { dropWaitingCircleJobs, studioStatus } from "./image-queue";
import { createCircleWorkerToken, cleanComputerName, listCircleTokens, revokeAllCircleTokens, revokeWorkerToken } from "./worker-tokens";
import {
  CIRCLE_INVITE_DAYS,
  inviteStatus,

  MAX_OPEN_CIRCLE_INVITES,
  type CircleInvite,
  type CircleMember,
  type CircleProblem,
  type CircleView,
} from "./circles-core";

// Circles, the database side (migration 063). Every function takes the signed-in person's id and checks their place in the circle itself,
// so a route cannot act on a circle the person does not belong to. Server code only; the browser uses lib/circles-core.ts.

export type Result<T = void> = { ok: true; value: T } | { ok: false; problem: CircleProblem };
const fail = (problem: CircleProblem): { ok: false; problem: CircleProblem } => ({ ok: false, problem });
const done = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** Postgres refused a row because of a unique index (here: the person is already in a circle, or already owns one). */
const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "23505";

/** Admins always may; anyone else only when an admin has switched it on for them. */
export async function canMakeCircles(userId: number): Promise<boolean> {
  const row = await queryOne<{ is_admin: number; can_make_circles: number }>("SELECT is_admin, can_make_circles FROM users WHERE id = $1", [userId]);
  return !!row && (row.is_admin === 1 || row.can_make_circles === 1);
}

export async function setCanMakeCircles(userId: number, allowed: boolean): Promise<void> {
  await query("UPDATE users SET can_make_circles = $1 WHERE id = $2", [allowed ? 1 : 0, userId]);
}

/** The person's circle and their place in it, or null. */
export async function membership(userId: number, db?: PoolClient): Promise<{ circle_id: number; owner_id: number } | null> {
  const sql = "SELECT c.id AS circle_id, c.owner_id FROM circle_members m JOIN circles c ON c.id = m.circle_id WHERE m.user_id = $1";
  if (db) return (await db.query(sql, [userId])).rows[0] ?? null;
  return queryOne(sql, [userId]);
}

/** The circle the person owns, when `circleId` is it; otherwise the reason it is not theirs to manage. */
export async function ownedCircle(userId: number, circleId: number): Promise<Result<number>> {
  const m = await membership(userId);
  if (!m || m.circle_id !== circleId) return fail("not_found");
  if (m.owner_id !== userId) return fail("not_owner");
  return done(circleId);
}

/** Everything the Circle page shows this person. Other members' writing is never read here: only their names and when they joined. */
export async function circleView(userId: number): Promise<CircleView> {
  const can_make = await canMakeCircles(userId);
  const circle = await queryOne<{
    id: number;
    name: string;
    owner_id: number;
    created_at: string;
    claude_member_daily_limit: number;
    claude_daily_limit: number;
    shares_with_host_at: string | null;
  }>(
    `SELECT c.id, c.name, c.owner_id, c.created_at, c.claude_member_daily_limit, c.claude_daily_limit, m.shares_with_host_at
     FROM circle_members m JOIN circles c ON c.id = m.circle_id WHERE m.user_id = $1`,
    [userId]
  );
  if (!circle) return { circle: null, invites: [], can_make, my_id: userId };

  const tz = quotaTimeZone();
  const members = await query<CircleMember & { shares_with_host_at: string | null; ai_today: number }>(
    `SELECT u.id AS user_id, u.username, u.display_name, m.joined_at, (u.id = $2) AS is_owner, m.shares_with_host_at,
            COALESCE(a.calls, 0)::int AS ai_today
     FROM circle_members m JOIN users u ON u.id = m.user_id
     LEFT JOIN circle_ai_usage a ON a.circle_id = m.circle_id AND a.user_id = m.user_id AND a.day = (NOW() AT TIME ZONE $3)::date
     WHERE m.circle_id = $1 ORDER BY (u.id = $2) DESC, m.joined_at ASC`,
    [circle.id, circle.owner_id, tz]
  );
  const isOwner = circle.owner_id === userId;
  const invites = isOwner
    ? (
        await query<{ id: number; note: string | null; created_at: string; expires_at: string; used_at: string | null; revoked_at: string | null; used_by_name: string | null }>(
          `SELECT i.id, i.note, i.created_at, i.expires_at, i.used_at, i.revoked_at, COALESCE(u.display_name, u.username) AS used_by_name
           FROM circle_invites i LEFT JOIN users u ON u.id = i.used_by
           WHERE i.circle_id = $1 ORDER BY i.created_at DESC, i.id DESC LIMIT 50`,
          [circle.id]
        )
      ).map(({ used_at, revoked_at, ...r }) => ({ ...r, status: inviteStatus({ used_at, revoked_at, expires_at: r.expires_at }) }))
    : [];
  const key = await queryOne<{ last4: string; set_at: string }>("SELECT last4, set_at FROM circle_claude_keys WHERE circle_id = $1", [circle.id]);
  const usedToday = members.reduce((sum, m) => sum + m.ai_today, 0);
  const computers = await listCircleTokens(circle.id);
  const awake = computers.length > 0 ? (await studioStatus(new Date(), circle.id)).awake : null;
  return {
    circle: {
      id: circle.id,
      name: circle.name,
      created_at: circle.created_at,
      is_owner: isOwner,
      max_members: maxCircleMembers(),
      // Only the owner is told who agreed to use the key and how much each member used today; a member sees names and join dates.
      members: members.map(({ shares_with_host_at, ai_today, ...m }) => (isOwner ? { ...m, agreed: shares_with_host_at !== null, ai_today } : m)),
      claude: {
        has_key: !!key,
        last4: isOwner ? (key?.last4 ?? null) : null,
        set_at: isOwner ? (key?.set_at ?? null) : null,
        member_limit: circle.claude_member_daily_limit,
        circle_limit: circle.claude_daily_limit,
        used_today: isOwner ? usedToday : null,
        can_store: masterKey() !== null,
      },
      pictures: { has_computer: computers.length > 0, awake, computers: isOwner ? computers : [] },
      i_agreed: circle.shares_with_host_at !== null,
    },
    invites,
    can_make,
    my_id: userId,
  };
}

/** Makes a circle with this person as its owner and first member. */
export async function createCircle(userId: number, name: string): Promise<Result<number>> {
  if (!(await canMakeCircles(userId))) return fail("not_allowed");
  try {
    return await withTransaction(async (db) => {
      if (await membership(userId, db)) return fail("already_in_one");
      const { rows } = await db.query<{ id: number }>("INSERT INTO circles (name, owner_id) VALUES ($1, $2) RETURNING id", [name, userId]);
      // The owner brings the key, so using it for their own requests is theirs to decide; they can withdraw on the Circle page like anyone.
      await db.query("INSERT INTO circle_members (circle_id, user_id, shares_with_host_at) VALUES ($1, $2, NOW())", [rows[0].id, userId]);
      return done(rows[0].id);
    });
  } catch (err) {
    if (isUniqueViolation(err)) return fail("already_in_one");
    throw err;
  }
}

export async function renameCircle(userId: number, circleId: number, name: string): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  await query("UPDATE circles SET name = $1 WHERE id = $2 AND owner_id = $3", [name, circleId, userId]);
  return done(undefined);
}

/** Deletes the circle; its members and codes go with it (nobody's own writing is touched). */
export async function deleteCircle(userId: number, circleId: number): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  await query("DELETE FROM circles WHERE id = $1 AND owner_id = $2", [circleId, userId]);
  return done(undefined);
}

/** Makes a single-use code for the circle and returns it. This is the only time the code exists in readable form. */
export async function createCircleInvite(userId: number, circleId: number, note: string | null): Promise<Result<{ id: number; code: string; expires_at: string }>> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  const open = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM circle_invites WHERE circle_id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()",
    [circleId]
  );
  if ((open?.n ?? 0) >= MAX_OPEN_CIRCLE_INVITES) return fail("too_many_codes");
  const code = makeCode();
  const row = await queryOne<{ id: number; expires_at: string }>(
    `INSERT INTO circle_invites (circle_id, code_hash, note, created_by, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(days => $5)) RETURNING id, expires_at`,
    [circleId, hashCode(normalizeCode(code)), note, userId, CIRCLE_INVITE_DAYS]
  );
  return done({ id: row!.id, code, expires_at: row!.expires_at });
}

export async function revokeCircleInvite(userId: number, circleId: number, inviteId: number): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  const row = await queryOne(
    "UPDATE circle_invites SET revoked_at = NOW() WHERE id = $1 AND circle_id = $2 AND used_at IS NULL AND revoked_at IS NULL RETURNING id",
    [inviteId, circleId]
  );
  return row ? done(undefined) : fail("not_found");
}

/**
 * Joins the circle a code belongs to. All in one transaction: the code is used up only if the person really joins, so a code is never
 * wasted on someone who is already in a circle or on a full circle. `normalized` is the code in capitals without dashes.
 */
export async function joinCircle(userId: number, normalized: string, agreed: boolean): Promise<Result<number>> {
  // Nothing is used up until the person has been shown, and agreed to, what goes where (open item C5).
  if (!agreed) return fail("not_agreed");
  try {
    return await withTransaction(async (db) => {
      if (await membership(userId, db)) return fail("already_in_one");
      const { rows } = await db.query<{ id: number; circle_id: number }>(
        `UPDATE circle_invites SET used_at = NOW(), used_by = $2
         WHERE code_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
         RETURNING id, circle_id`,
        [hashCode(normalized), userId]
      );
      if (!rows[0]) return fail("bad_code");
      const circleId = rows[0].circle_id;
      // Lock the circle so two people joining at once cannot both take the last place.
      await db.query("SELECT id FROM circles WHERE id = $1 FOR UPDATE", [circleId]);
      const { rows: count } = await db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM circle_members WHERE circle_id = $1", [circleId]);
      if (count[0].n >= maxCircleMembers()) throw new CircleFull();
      await db.query("INSERT INTO circle_members (circle_id, user_id, shares_with_host_at) VALUES ($1, $2, NOW())", [circleId, userId]);
      return done(circleId);
    });
  } catch (err) {
    // Thrown (not returned) so the transaction is rolled back and the code stays unused.
    if (err instanceof CircleFull) return fail("full");
    if (isUniqueViolation(err)) return fail("already_in_one");
    throw err;
  }
}

class CircleFull extends Error {}

/**
 * Looks at a circle code without using it up: the circle's name and how many accounts its codes have made so far, or null when the code does
 * not work.
 */
export async function peekCircleCode(normalized: string): Promise<{ circle_id: number; circle_name: string; made: number } | null> {
  const row = await queryOne<{ circle_id: number; circle_name: string; made: number }>(
    `SELECT i.circle_id, c.name AS circle_name,
            (SELECT COUNT(*)::int FROM circle_invites x WHERE x.circle_id = i.circle_id AND x.made_account) AS made
       FROM circle_invites i JOIN circles c ON c.id = i.circle_id
      WHERE i.code_hash = $1 AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()`,
    [hashCode(normalized)]
  );
  return row ?? null;
}

/** Records that the person's account was made with this code (it counts toward the circle's ceiling, MAX_ACCOUNTS_PER_CIRCLE). */
export async function markCodeMadeAccount(normalized: string, userId: number): Promise<void> {
  await query("UPDATE circle_invites SET made_account = TRUE WHERE code_hash = $1 AND used_by = $2", [hashCode(normalized), userId]);
}

/**
 * Takes someone out of the circle: the owner removing a member, or a member leaving (memberId is their own id). The owner cannot leave
 * this way; they hand the circle over or delete it.
 */
export async function removeMember(userId: number, circleId: number, memberId: number): Promise<Result> {
  const m = await membership(userId);
  if (!m || m.circle_id !== circleId) return fail("not_found");
  if (memberId === m.owner_id) return fail("owner_cannot_leave");
  if (memberId !== userId && m.owner_id !== userId) return fail("not_owner");
  const row = await queryOne("DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2 RETURNING user_id", [circleId, memberId]);
  if (!row) return fail("not_found");
  await dropWaitingCircleJobs(circleId, memberId, "You are not in that circle any more, so its picture computer will not make this picture. Ask again.");
  return done(undefined);
}

/** The owner hands the circle to another member, who becomes its owner; the old owner stays in it as a member. */
export async function handOverCircle(userId: number, circleId: number, newOwnerId: number): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  if (newOwnerId === userId) return done(undefined);
  const member = await queryOne("SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2", [circleId, newOwnerId]);
  if (!member) return fail("not_found");
  await query("UPDATE circles SET owner_id = $1 WHERE id = $2 AND owner_id = $3", [newOwnerId, circleId, userId]);
  // The Claude key is the old owner's own and their Anthropic account's: it does not pass to the new owner, who can bring their own.
  await query("DELETE FROM circle_claude_keys WHERE circle_id = $1", [circleId]);
  // The picture computers are the old owner's too: they stop working, and what was waiting for them is given up.
  await revokeAllCircleTokens(circleId);
  return done(undefined);
}

/** The owner adds a picture computer for the circle. The reply holds the readable token, which is never shown again. */
export async function addCircleComputer(userId: number, circleId: number, rawName: unknown): Promise<Result<{ id: number; token: string; name: string }>> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  const name = cleanComputerName(rawName);
  if (!name) return fail("bad_name");
  const made = await createCircleWorkerToken(userId, circleId, name);
  if (!made) return fail("too_many_computers");
  return done({ ...made, name });
}

/** The owner removes one of the circle's picture computers; it stops working at once. */
export async function removeCircleComputer(userId: number, circleId: number, tokenId: number): Promise<Result> {
  const owned = await ownedCircle(userId, circleId);
  if (!owned.ok) return owned;
  return (await revokeWorkerToken(tokenId, circleId)) ? done(undefined) : fail("not_found");
}

/**
 * Before an account is deleted: if it owns a circle, the member who joined first becomes the owner, so the others keep their circle.
 * A circle with nobody else in it is left for the database's cascade to remove.
 */
export async function handOverBeforeDelete(userId: number): Promise<void> {
  // The key belongs to the account that is going away; it is not passed on.
  await query("DELETE FROM circle_claude_keys WHERE circle_id IN (SELECT id FROM circles WHERE owner_id = $1)", [userId]);
  // Their picture computers stop working too (a circle with other people in it keeps existing, without them).
  for (const c of await query<{ id: number }>("SELECT id FROM circles WHERE owner_id = $1", [userId])) await revokeAllCircleTokens(c.id);
  await query(
    `UPDATE circles c SET owner_id = next.user_id
     FROM (SELECT m.circle_id, m.user_id FROM circle_members m JOIN circles c2 ON c2.id = m.circle_id
           WHERE c2.owner_id = $1 AND m.user_id <> $1 ORDER BY m.joined_at ASC LIMIT 1) AS next
     WHERE c.id = next.circle_id`,
    [userId]
  );
}
