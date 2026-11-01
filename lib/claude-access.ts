import Anthropic from "@anthropic-ai/sdk";
import { aiGate, takeCircleCall } from "./ai-quota";
import { circleKeyFor } from "./circle-claude";
import { NEEDS_ADULT_MESSAGE, adultConfirmed } from "./adult";

// The one place a Claude route gets its client and its permission to call. It decides whose key pays (a circle's, for a member who agreed to it; the
// app's own otherwise) and counts the request against the right limits: the circle's for a circle key (open item C2), the app's for the app's key.
// Every Claude route calls this in place of building its own client, so no route can reach for a key by itself.

export type ClaudeAccess =
  | { ok: true; client: Anthropic; source: "circle" | "app"; circleId: number | null }
  | { ok: false; response: Response };

let appClient: Anthropic | null = null;

const refuse = (error: string, status: number, code = "ai_unavailable"): { ok: false; response: Response } => ({
  ok: false,
  response: Response.json({ error, code }, { status }),
});

/**
 * Counts one Claude request for this person and returns a client holding the key that pays for it, or the answer to send back. Call it after the
 * request has been checked and before talking to Claude.
 */
export async function claudeAccess(userId: unknown, kind: string): Promise<ClaudeAccess> {
  if (typeof userId !== "number") return refuse("Unauthorized", 401);
  // The Claude buttons need "I am 18 or older" (owner decision 2026-10-22, lib/adult.ts). Checked before any limit is counted.
  if (!(await adultConfirmed(userId))) return refuse(NEEDS_ADULT_MESSAGE, 403, "needs_adult");

  const circle = await circleKeyFor(userId);
  if (circle && "unreadable" in circle) {
    // Say so; do not fall back to the app's key, which is somebody else's money.
    console.error(`[ai] ${kind}: circle ${circle.circleId}'s stored Claude key cannot be opened (is CIRCLE_KEY_SECRET the same as when it was saved?)`);
    return refuse("Your circle's Claude key cannot be used right now. Ask the person who runs the circle to enter it again.", 503);
  }
  if (circle) {
    const gate = await takeCircleCall(userId, circle.circleId, kind);
    if (!gate.ok) return refuse(gate.error, gate.status, "ai_limit");
    return { ok: true, client: new Anthropic({ apiKey: circle.apiKey }), source: "circle", circleId: circle.circleId };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return refuse("ANTHROPIC_API_KEY not configured", 503);
  const blocked = await aiGate(userId, kind);
  if (blocked) return { ok: false, response: blocked };
  appClient ??= new Anthropic({ apiKey: key });
  return { ok: true, client: appClient, source: "app", circleId: null };
}

