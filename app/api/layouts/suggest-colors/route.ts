import { NextRequest } from "next/server";
import { aiFailure } from "@/lib/ai-log";
import { claudeAccess } from "@/lib/claude-access";
import { getSession } from "@/lib/session";
import { POSITION_COLORS } from "@/lib/position-colors";
import { jsonBody } from "@/lib/own-http";


const VALID_HEXES = new Set<string>(POSITION_COLORS.map((c) => c.hex));

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { positions } = sent;
  if (!Array.isArray(positions) || positions.length === 0 || positions.length > 40 || JSON.stringify(positions).length > 6000) {
    return Response.json({ error: "positions must be a list of 1 to 40 short items" }, { status: 400 });
  }

  const access = await claudeAccess(session.userId, "suggest-colors");
  if (!access.ok) return access.response;
  const client = access.client;

  const model = process.env.HAIKU_MODEL ?? "claude-haiku-4-5-20251001";

  const systemPrompt = `You assign colors to tarot spread positions based on their semantic meaning.
Available colors (use these exact hex values only):
- #f43f5e — Challenge, Conflict, Tension, Shadow, Obstacle
- #f59e0b — Outcome, Potential, Future, Crossing, Result
- #10b981 — Growth, Guidance, Advice, Healing, Path Forward
- #38bdf8 — Clarity, Past, Intellect, Air, Memory
- #a855f7 — Spiritual, Wisdom, Higher Self, Mystery, Present
- #6366f1 — Subconscious, Hidden, Unconscious, Deep Self
- #14b8a6 — Balance, Communication, Harmony, External
- #e879f9 — Emotion, Heart, Love, Relationship
- #fb923c — Action, Energy, Passion, Fire, Drive
- #fbbf24 — Consciousness, Solar, Ego, Identity, Crown
- #94a3b8 — Foundation, Earth, Stability, Material, Root
- #7c3aed — Mystery, General, Default

Respond with ONLY a valid JSON array of hex strings, one per position, in order. No other text.`;

  const userMessage = `Positions:\n${JSON.stringify(positions, null, 2)}`;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const colors = JSON.parse(text);

    if (
      !Array.isArray(colors) ||
      colors.length !== positions.length ||
      !colors.every((c: unknown) => typeof c === "string" && VALID_HEXES.has(c))
    ) {
      return Response.json({ error: "Invalid color response from AI" }, { status: 502 });
    }

    return Response.json({ colors });
  } catch (err) {
    // Claude's answer was not the list of colours asked for.
    if (err instanceof SyntaxError) return Response.json({ error: "Invalid color response from AI" }, { status: 502 });
    return aiFailure("suggest-colors", err);
  }
}
