import { createHmac } from "node:crypto";
import { query } from "./db";

// Limits failed sign-ins. Two counters are kept: one per address and one per username, so a spread of
// addresses cannot guess one account's password, and a spoofed address header cannot reset the count.
// Failures live in the login_attempts table (migration 034). While a local copy's data is locked (lib/seal.ts) the same rules run from
// memory, because the password that opens it is checked before the database can be asked.

export const WINDOW_MINUTES = 15;
export const MAX_PER_IP = 5;
export const MAX_PER_USER = 10;

const memory = new Map<string, number[]>();

const dataLocked = (err: unknown) => (err as { code?: string })?.code === "DS_LOCKED";

/** The counter key for an address: a keyed hash, never the address. A plain hash of an IPv4 address can be
 *  reversed by trying all 4 billion of them, so the hash uses the server's secret. Sixteen bytes is plenty
 *  to tell addresses apart. The address itself is never written to the database. */
export function ipKey(prefix: string, ip: string, secret = process.env.SESSION_SECRET ?? ""): string {
  return `${prefix}:${createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32)}`;
}

export function loginKeys(ip: string, username: string): { ip: string; user: string } {
  return { ip: ipKey("ip", ip), user: `user:${username.trim().toLowerCase().slice(0, 100)}` };
}

function recentMemory(key: string): number[] {
  const cutoff = Date.now() - WINDOW_MINUTES * 60_000;
  const recent = (memory.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length) memory.set(key, recent);
  else memory.delete(key);
  return recent;
}

async function countRecent(key: string): Promise<number> {
  try {
    const rows = (await query(
      `SELECT COUNT(*)::int AS n FROM login_attempts
       WHERE key = $1 AND attempted_at > NOW() - make_interval(mins => $2)`,
      [key, WINDOW_MINUTES]
    )) as { n: number }[];
    return rows[0]?.n ?? 0;
  } catch (err) {
    if (!dataLocked(err)) throw err;
    return recentMemory(key).length;
  }
}

export async function isLoginLimited(keys: { ip: string; user: string }): Promise<boolean> {
  const [byIp, byUser] = await Promise.all([countRecent(keys.ip), countRecent(keys.user)]);
  return byIp >= MAX_PER_IP || byUser >= MAX_PER_USER;
}

export async function recordLoginFailure(keys: { ip: string; user: string }): Promise<void> {
  try {
    await query("INSERT INTO login_attempts (key) VALUES ($1), ($2)", [keys.ip, keys.user]);
    await query("DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'");
  } catch (err) {
    if (!dataLocked(err)) throw err;
    for (const k of [keys.ip, keys.user]) memory.set(k, [...recentMemory(k), Date.now()]);
  }
}

export async function clearLoginFailures(keys: { ip: string; user: string }): Promise<void> {
  try {
    await query("DELETE FROM login_attempts WHERE key = ANY($1)", [[keys.ip, keys.user]]);
  } catch (err) {
    if (!dataLocked(err)) throw err;
    memory.delete(keys.ip);
    memory.delete(keys.user);
  }
}

/** The caller's address, from the headers a reverse proxy sets. Without one in front they can be forged,
 *  which is why the username counter exists too. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}
