// Size and speed limits that stop one account filling the database or hammering the server. Pure functions, so they can be tested.

/** The largest request body (in bytes) most routes accept. Text is never this big; pictures use the routes in BIG_BODY_PATHS. */
export const MAX_JSON_BYTES = 300_000;

/** Routes that carry pictures or drawings and so may send a bigger body (their own routes check the size again). */
export const BIG_BODY_PATHS = [
  /^\/api\/oracle\/cards\/\d+\/art$/,
  /^\/api\/oracle\/gallery(\/\d+)?$/,
  /^\/api\/oracle\/image-tool$/,
  /^\/api\/sigil$/,
  /^\/api\/export/,
  // An export brought back in (the route checks the size again: IMPORT_LIMITS.bytes).
  /^\/api\/import$/,
  // A finished picture from the studio (the route allows MAX_RESULT_BYTES, 1.5 MB).
  /^\/api\/worker\/pictures\/\d+\/done$/,
];

/** True when a request with this path and Content-Length is too big for the route. A missing length is let through. */
export function bodyTooBig(pathname: string, contentLength: string | null): boolean {
  if (!contentLength) return false;
  const n = Number(contentLength);
  if (!Number.isFinite(n)) return false;
  if (BIG_BODY_PATHS.some((re) => re.test(pathname))) return false;
  return n > MAX_JSON_BYTES;
}

/** Counts events in a sliding window per key, in this server's memory only. `lib/shared-limits.ts` uses it as the fallback when Redis is not available, and counts across servers otherwise. */
export class SlidingWindow {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number, private maxKeys = 2000) {}

  /** Records an event and says whether it is within the limit. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) this.hits.clear();
    this.hits.set(key, recent);
    return true;
  }
}

/** Writes per person: this many in a minute. A person clicking quickly never reaches it; a script or a loop does. */
export const WRITES_PER_MINUTE = 90;

/** `value` as text no longer than `max`, or null when it is not text. */
export function clip(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

/** True when `value` is text longer than `max`. */
export function tooLong(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > max;
}

/** The first `max` entries of `value` when it is a list, otherwise an empty list. */
export function firstOf<T>(value: unknown, max: number): T[] {
  return Array.isArray(value) ? (value.slice(0, max) as T[]) : [];
}

/** Positive whole numbers only, at most `max` of them, no repeats. */
export function idList(value: unknown, max: number): number[] {
  const out = new Set<number>();
  for (const v of Array.isArray(value) ? value : []) {
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
    if (Number.isInteger(n) && n > 0 && n <= 2147483647) out.add(n);
    if (out.size >= max) break;
  }
  return [...out];
}
