import { createHash } from "crypto";
import { queryOne } from "./db";
import { FEATHERED, editionOf } from "./edition";
import { ALL_AI, NO_AI, verdictLifetimeMs, type AiReady, type KeyVerdict } from "./ai-ready-core";
import { checkKeyWithAnthropic, circleKeyFor } from "./circle-claude";
import { companionEndpoint } from "./companion-model";
import { configuredImageToolUrl } from "./image-tool";
import { imageMode, pictureCircleOf } from "./image-queue";

// Works out lib/ai-ready-core.ts's answer for one person. Server code only. A hosted copy keeps every feature as before; a copy on a person's own
// computer shows each AI feature only when what it needs is set up. Any database error (a table not there yet) counts as "not set up".

const verdicts = new Map<string, { verdict: Promise<KeyVerdict>; at: number }>();

/**
 * Whether Anthropic accepts this key (the key itself is never kept here, only its hash). Only the first page after the app starts waits for the
 * answer; after that a page uses the last answer, and an answer older than verdictLifetimeMs is asked again in the background.
 */
async function keyWorks(apiKey: string, now = Date.now()): Promise<boolean> {
  const id = createHash("sha256").update(apiKey).digest("hex");
  const seen = verdicts.get(id);
  if (!seen) {
    const verdict = checkKeyWithAnthropic(apiKey);
    verdicts.set(id, { verdict, at: now });
    return (await verdict) === "ok";
  }
  const verdict = await seen.verdict;
  if (now - seen.at >= verdictLifetimeMs(verdict)) {
    // Keep the old answer until the new one is in, so a page never waits on a slow connection.
    const next = checkKeyWithAnthropic(apiKey);
    seen.at = now;
    next.then((v) => verdicts.set(id, { verdict: Promise.resolve(v), at: Date.now() }));
  }
  return verdict === "ok";
}

/** Mirrors lib/claude-access.ts: a circle's key, when the person agreed to it, is the only one tried; otherwise the app's own key. */
async function claudeReady(userId: number): Promise<boolean> {
  const circle = await circleKeyFor(userId).catch(() => null);
  if (circle) return "apiKey" in circle ? keyWorks(circle.apiKey) : false;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? keyWorks(key) : false;
}

async function exists(sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    return (await queryOne<{ ok: number }>(sql, params)) !== null;
  } catch {
    return false;
  }
}

async function companionReady(): Promise<boolean> {
  if (companionEndpoint()) return true;
  // The app's own studio (a circle's computer takes pictures only).
  return exists("SELECT 1 AS ok FROM worker_tokens WHERE revoked_at IS NULL AND can_companion = 1 AND circle_id IS NULL LIMIT 1");
}

async function picturesReady(userId: number): Promise<boolean> {
  if (imageMode() === "direct") return configuredImageToolUrl() !== null;
  if (await exists("SELECT 1 AS ok FROM worker_tokens WHERE revoked_at IS NULL AND can_pictures = 1 AND circle_id IS NULL LIMIT 1")) return true;
  return (await pictureCircleOf(userId).catch(() => null)) !== null;
}

/** Which AI features can run for this person on this copy. Signed out: none. */
export async function aiReadyFor(userId: number | undefined | null): Promise<AiReady> {
  if (FEATHERED || typeof userId !== "number") return NO_AI;
  if (editionOf() !== "local") return ALL_AI;
  const [claude, companion, pictures] = await Promise.all([claudeReady(userId), companionReady(), picturesReady(userId)]);
  return { claude, companion, pictures };
}
