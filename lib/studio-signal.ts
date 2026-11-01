// The Redis doorbell between the website and the picture studio on the owner's computer (docs/picture-queue.md).
// Redis holds no data, only a note that says "look at the queue" (list ds:wake) and a flag that says the studio is running
// (ds:alive, set by the studio with a 75 second expiry). The website talks to Upstash's REST address with plain fetch, so
// there is no package on the website's side; the studio holds one outbound connection with ioredis (scripts/image-worker.ts).
// Everything here is best effort: when Redis is not set up or does not answer, the picture simply waits in the queue.

import { FEATHERED } from "./edition";

export const WAKE_LIST = "ds:wake";
export const ALIVE_KEY = "ds:alive";
/** How long the studio's "I am running" flag lives without being renewed, in seconds. */
export const ALIVE_SECONDS = 75;
const WAKE_KEEP = 20;
const WAKE_EXPIRE_SECONDS = 3600;
const TIMEOUT_MS = 4000;

export interface RedisRest {
  url: string;
  token: string;
}

/** The Upstash REST address and token from the environment, or null when the doorbell is not set up. */
export function redisRest(env: Record<string, string | undefined> = process.env, feathered = FEATHERED): RedisRest | null {
  // The Feathered edition makes no outgoing connection (docs/plan-feathered-edition.md); its limits are counted in this process.
  if (feathered) return null;
  const url = env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token || !/^https:\/\//i.test(url)) return null;
  return { url, token };
}

/** The three commands that leave a note: add one, keep only the newest few, make old notes expire. */
export function wakeCommands(): (string | number)[][] {
  return [
    ["LPUSH", WAKE_LIST, "1"],
    ["LTRIM", WAKE_LIST, 0, WAKE_KEEP - 1],
    ["EXPIRE", WAKE_LIST, WAKE_EXPIRE_SECONDS],
  ];
}

/** Request for Upstash's /pipeline endpoint: several commands in one round trip. */
export function pipelineRequest(rest: RedisRest, commands: (string | number)[][]): { url: string; init: RequestInit } {
  return {
    url: `${rest.url}/pipeline`,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${rest.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    },
  };
}

/** Rings the doorbell. Never throws; returns whether Redis accepted the note. */
export async function pushWake(rest: RedisRest, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const { url, init } = pipelineRequest(rest, wakeCommands());
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

/** True/false when Redis says whether the studio is running; null when Redis is not set up or does not answer. */
export async function studioAliveFromRedis(rest: RedisRest | null = redisRest(), fetchImpl: typeof fetch = fetch): Promise<boolean | null> {
  if (!rest) return null;
  try {
    const res = await fetchImpl(`${rest.url}/get/${ALIVE_KEY}`, {
      headers: { Authorization: `Bearer ${rest.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    return body.result !== null && body.result !== undefined;
  } catch {
    return null;
  }
}

/** Server code only: rings the doorbell after the answer has been sent. Nothing depends on it working. */
export async function signalStudio(): Promise<void> {
  const rest = redisRest();
  if (!rest) return;
  const { after } = await import("next/server");
  after(async () => {
    await pushWake(rest);
  });
}
