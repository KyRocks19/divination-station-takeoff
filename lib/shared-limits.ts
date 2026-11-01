// Rate limits that hold across servers (open item S1). A hosting platform can run many copies of the app and each copy used to count on its own,
// so a person could get several times the limit. The count now lives in the Upstash Redis the app already uses for the picture
// doorbell, reached with plain fetch (no package). One INCR per call, in a one-minute (or other) bucket that expires by itself.
//
// If Redis is not set up, or does not answer, each server falls back to counting for itself (the old behaviour), so a Redis
// outage never stops anyone writing or asking. After a failure Redis is left alone for a short while, so a slow Redis does not
// add its timeout to every request.

import { SlidingWindow } from "./limits";
import { pipelineRequest, redisRest, type RedisRest } from "./studio-signal";

const TIMEOUT_MS = 1500;
/** How long to leave Redis alone after it failed, in milliseconds. */
export const RETRY_AFTER_FAILURE_MS = 30_000;

/** The Redis key for one counter in one bucket of time. */
export function bucketKey(name: string, key: string, windowMs: number, now: number): string {
  return `ds:rl:${name}:${key}:${Math.floor(now / windowMs)}`;
}

/** The two commands for one call: count it, and make the bucket expire on its own (twice the window is plenty). */
export function limiterCommands(redisKey: string, windowMs: number): (string | number)[][] {
  return [["INCR", redisKey], ["EXPIRE", redisKey, Math.max(2, Math.ceil((windowMs * 2) / 1000))]];
}

/** The count out of Upstash's pipeline answer, or null when the answer is not what was expected. */
export function countFrom(body: unknown): number | null {
  if (!Array.isArray(body)) return null;
  const first = body[0] as { result?: unknown; error?: unknown } | undefined;
  return first && typeof first.result === "number" && !first.error ? first.result : null;
}

export interface Limiter {
  /** Counts one event for `key` and says whether it is within the limit. Never throws. */
  allow(key: string): Promise<boolean>;
}

interface Options {
  rest?: RedisRest | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** A limiter of `max` events per `windowMs` for each key, shared across servers when Redis is set up. */
export function makeLimiter(name: string, max: number, windowMs: number, options: Options = {}): Limiter {
  const local = new SlidingWindow(max, windowMs);
  const now = options.now ?? Date.now;
  let downUntil = 0;
  return {
    async allow(key: string): Promise<boolean> {
      const rest = options.rest === undefined ? redisRest() : options.rest;
      if (!rest || now() < downUntil) return local.allow(key, now());
      try {
        const { url, init } = pipelineRequest(rest, limiterCommands(bucketKey(name, key, windowMs, now()), windowMs));
        const res = await (options.fetchImpl ?? fetch)(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
        const count = res.ok ? countFrom(await res.json()) : null;
        if (count === null) throw new Error(`Redis answered ${res.status}`);
        return count <= max;
      } catch (err) {
        downUntil = now() + RETRY_AFTER_FAILURE_MS;
        console.warn(`[limits] ${name}: Redis did not answer (${err instanceof Error ? err.message : err}); counting on this server for a while`);
        return local.allow(key, now());
      }
    },
  };
}
