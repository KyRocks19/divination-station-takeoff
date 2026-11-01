import { query, queryOne, withTransaction } from "./db";
import { makeLimiter } from "./shared-limits";

// Limits how often each person can ask Claude for help. Claude is the one part of the app that costs money for every
// use, so three limits stand between a person and the bill: a few calls a minute, a number of calls a day, and one
// number for everybody together. A request that fails before Claude answers still counts (rare, and the day's limit is generous).

export const DEFAULT_DAILY_LIMIT = 15;
export const DEFAULT_GLOBAL_DAILY_LIMIT = 300;
export const PER_MINUTE = 6;

/** The daily limit for one person: their own number if an admin set one, otherwise AI_DAILY_LIMIT, otherwise 15. */
export function dailyLimit(override: number | null | undefined, envValue = process.env.AI_DAILY_LIMIT): number {
  if (typeof override === "number" && Number.isInteger(override) && override >= 0) return override;
  const n = Number(envValue);
  return envValue !== undefined && envValue !== "" && Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT;
}

export function globalDailyLimit(envValue = process.env.AI_GLOBAL_DAILY_LIMIT): number {
  const n = Number(envValue);
  return envValue !== undefined && envValue !== "" && Number.isInteger(n) && n >= 0 ? n : DEFAULT_GLOBAL_DAILY_LIMIT;
}

/** The time zone whose midnight starts a new day (AI_QUOTA_TIMEZONE, for example America/New_York; default UTC). */
export function quotaTimeZone(envValue = process.env.AI_QUOTA_TIMEZONE): string {
  const tz = envValue?.trim();
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export type Gate = { ok: true; used: number; limit: number } | { ok: false; status: number; error: string };

// Counted in Redis so every server shares the count (each server counts alone when Redis is not set up).
const perMinute = makeLimiter("claude", PER_MINUTE, 60_000);

/** The words a person sees when a limit stops them. Plain, and says when it ends. */
export function limitMessage(reason: "off" | "day" | "minute" | "everyone" | "circleMember" | "circleAll", limit: number): string {
  switch (reason) {
    case "circleMember":
      return `You have used your ${limit} Claude requests through your circle for today. They come back at midnight. Everything else in the app still works.`;
    case "circleAll":
      return "Your circle has used its Claude requests for today. They come back at midnight. Everything else in the app still works.";
    case "off":
      return "Claude help is switched off for your account. Ask the person who runs this app if you want it on.";
    case "day":
      return `You have used your ${limit} Claude requests for today. They come back at midnight. Everything else in the app still works.`;
    case "minute":
      return "That was a lot of requests in a minute. Wait a moment and try again.";
    case "everyone":
      return "Claude help has reached its limit for today across the whole app. It comes back at midnight.";
  }
}

/**
 * Counts one Claude request for this person and says whether it may go ahead. The count goes up in one statement that
 * refuses to pass the limit, so two requests at once cannot both take the last place.
 */
export async function takeAiCall(userId: unknown, kind: string): Promise<Gate> {
  if (typeof userId !== "number") return { ok: false, status: 401, error: "Unauthorized" };
  if (!(await perMinute.allow(`u${userId}`))) return { ok: false, status: 429, error: limitMessage("minute", PER_MINUTE) };
  const tz = quotaTimeZone();
  const user = await queryOne<{ ai_daily_limit: number | null }>("SELECT ai_daily_limit FROM users WHERE id = $1", [userId]);
  const limit = dailyLimit(user?.ai_daily_limit);
  if (limit <= 0) return { ok: false, status: 403, error: limitMessage("off", 0) };

  const everyone = await queryOne<{ n: number }>(
    "SELECT COALESCE(SUM(calls), 0)::int AS n FROM ai_usage WHERE day = (NOW() AT TIME ZONE $1)::date",
    [tz]
  );
  if ((everyone?.n ?? 0) >= globalDailyLimit()) return { ok: false, status: 429, error: limitMessage("everyone", 0) };

  const row = await queryOne<{ calls: number }>(
    `INSERT INTO ai_usage (user_id, day, calls) VALUES ($1, (NOW() AT TIME ZONE $3)::date, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $2
     RETURNING calls`,
    [userId, limit, tz]
  );
  if (!row) return { ok: false, status: 429, error: limitMessage("day", limit) };
  console.info(`[ai] ${kind} for user ${userId}: ${row.calls} of ${limit} today`);
  return { ok: true, used: row.calls, limit };
}

/**
 * The same, for a request that goes through a circle's own Claude key (open item C2). The app's limits do not apply, because the app's owner does not
 * pay for it: the circle's two limits do (a number per member and a number for the whole circle, both set by the circle's owner), plus the few calls
 * a minute, plus the one switch of the app that still holds: an account whose Claude help the app's owner switched off (limit 0) stays off.
 * The circle's row is locked while the count goes up, so two members at once cannot both take the circle's last place.
 */
export async function takeCircleCall(userId: unknown, circleId: number, kind: string): Promise<Gate> {
  if (typeof userId !== "number") return { ok: false, status: 401, error: "Unauthorized" };
  if (!(await perMinute.allow(`u${userId}`))) return { ok: false, status: 429, error: limitMessage("minute", PER_MINUTE) };
  const tz = quotaTimeZone();
  const user = await queryOne<{ ai_daily_limit: number | null }>("SELECT ai_daily_limit FROM users WHERE id = $1", [userId]);
  if (dailyLimit(user?.ai_daily_limit) <= 0) return { ok: false, status: 403, error: limitMessage("off", 0) };
  return withTransaction<Gate>(async (db) => {
    const { rows: c } = await db.query<{ claude_member_daily_limit: number; claude_daily_limit: number }>(
      "SELECT claude_member_daily_limit, claude_daily_limit FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    if (!c[0]) return { ok: false, status: 404, error: "Your circle could not be found." };
    const memberLimit = c[0].claude_member_daily_limit;
    const { rows: total } = await db.query<{ n: number }>(
      "SELECT COALESCE(SUM(calls), 0)::int AS n FROM circle_ai_usage WHERE circle_id = $1 AND day = (NOW() AT TIME ZONE $2)::date",
      [circleId, tz]
    );
    if ((total[0]?.n ?? 0) >= c[0].claude_daily_limit) return { ok: false, status: 429, error: limitMessage("circleAll", 0) };
    // The INSERT's WHERE only guards the update of an existing row, so a limit of 0 must be refused before it (a first row would pass).
    if (memberLimit <= 0) return { ok: false, status: 429, error: limitMessage("circleMember", memberLimit) };
    const { rows } = await db.query<{ calls: number }>(
      `INSERT INTO circle_ai_usage (circle_id, user_id, day, calls) VALUES ($1, $2, (NOW() AT TIME ZONE $4)::date, 1)
       ON CONFLICT (circle_id, user_id, day) DO UPDATE SET calls = circle_ai_usage.calls + 1 WHERE circle_ai_usage.calls < $3
       RETURNING calls`,
      [circleId, userId, memberLimit, tz]
    );
    if (!rows[0]) return { ok: false, status: 429, error: limitMessage("circleMember", memberLimit) };
    console.info(`[ai] ${kind} for user ${userId} through circle ${circleId}: ${rows[0].calls} of ${memberLimit} today`);
    return { ok: true, used: rows[0].calls, limit: memberLimit };
  });
}

/** For a route: null when the request may go ahead, otherwise the answer to send back. */
export async function aiGate(userId: unknown, kind: string): Promise<Response | null> {
  const gate = await takeAiCall(userId, kind);
  return gate.ok ? null : Response.json({ error: gate.error, code: "ai_limit" }, { status: gate.status });
}

/** What each person has used today: Claude requests and pictures asked for. */
export async function usageToday(): Promise<Map<number, { calls: number; pictures: number }>> {
  const rows = await query<{ user_id: number; calls: number; pictures: number }>(
    "SELECT user_id, calls, pictures FROM ai_usage WHERE day = (NOW() AT TIME ZONE $1)::date",
    [quotaTimeZone()]
  );
  return new Map(rows.map((r) => [r.user_id, { calls: r.calls, pictures: r.pictures }]));
}
