import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatReadingForClaude, cardIdsOf, SEEKER_FIRST, type DrawnCard } from "@/lib/reading-context";
import { loadPersonalMeanings } from "@/lib/personal-meanings";
import { TAROT_DECK } from "@/lib/cards";
import { buildContextFor } from "@/lib/companion-subject";
import { DIVINATION_KIND_LABELS, type DivinationKind } from "@/lib/divination-kinds";
import { loadCrossTool } from "@/lib/guide-context";
import { crossToolText, guideSystem, practiceWords } from "@/lib/guide-prompts";

// The guide holds the larger arc across everything the person does (open item Y3, 2026-10-18). Body: { reading_id } for a tarot reading, or
// { divination_id } for a reading of any tool (a tarot one is answered as its tarot reading). For a reading with a tool other than tarot, and for the
// readings of other tools beside a tarot one, Claude is given only what the person wrote and the names of what came up (lib/guide-context.ts).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  let reading_id = body?.reading_id;
  const divination_id = body?.divination_id;
  if (reading_id == null && divination_id == null) {
    return Response.json({ error: "reading_id or divination_id required" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const user = await queryOne(
    "SELECT display_name, username, guide_name FROM users WHERE id = $1",
    [userId]
  ) as any;
  const displayName = user?.display_name || user?.username || "the querent";
  const guideName = user?.guide_name as string | null;

  if (reading_id == null) {
    const id = Number(divination_id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "divination_id is not valid" }, { status: 400 });
    const head = await queryOne<{ kind: DivinationKind; reading_id: number | null }>("SELECT kind, reading_id FROM divinations WHERE id = $1 AND user_id = $2", [id, userId]);
    if (!head) return Response.json({ error: "Reading not found" }, { status: 404 });
    if (head.kind !== "tarot") return guideOtherKind(userId, id, head.kind, displayName, guideName);
    if (!head.reading_id) return Response.json({ error: "Reading not found" }, { status: 404 });
    reading_id = head.reading_id;
  }

  const currentReading = await queryOne(
    "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
    [reading_id, userId]
  ) as any;
  if (!currentReading) {
    return Response.json({ error: "Reading not found" }, { status: 404 });
  }
  const currentJournals = await query(
    "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
    [reading_id]
  ) as any[];

  const allReadings = await query(
    "SELECT * FROM readings WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  ) as any[];

  const cardFrequency: Record<string, number> = {};
  const suitFrequency: Record<string, number> = { cups: 0, wands: 0, swords: 0, pentacles: 0, major: 0 };

  for (const r of allReadings) {
    const cards: DrawnCard[] = JSON.parse(r.cards);
    for (const c of cards) {
      cardFrequency[c.card_name] = (cardFrequency[c.card_name] || 0) + 1;
      const cardData = TAROT_DECK.find((t) => t.id === c.card_id);
      if (cardData) {
        const suit = cardData.suit?.toLowerCase() ?? "major";
        if (suit in suitFrequency) suitFrequency[suit as keyof typeof suitFrequency]++;
        else suitFrequency.major++;
      }
    }
  }

  const recurringCards = Object.entries(cardFrequency)
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => `${name} (×${count})`);

  const dominantSuit = Object.entries(suitFrequency).sort(([, a], [, b]) => b - a)[0]?.[0];

  const historicReadings = allReadings.filter((r: any) => r.id !== reading_id).slice(0, 12);
  const personal = await loadPersonalMeanings(
    userId,
    [currentReading, ...historicReadings].flatMap((r: any) => cardIdsOf(r))
  );

  const currentReadingBlock = formatReadingForClaude(currentReading, currentJournals, personal);

  const historyBlocks = await Promise.all(
    historicReadings.map(async (r: any) => {
      const journals = await query(
        "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
        [r.id]
      ) as any[];
      return formatReadingForClaude(r, journals, personal);
    })
  );

  const totalReadings = allReadings.length;

  // Readings with the other tools, in the person's own words (the tarot ones are already above, in full).
  const cross = await loadCrossTool(userId, { withTarot: false });
  const practice = practiceWords(cross.counts.filter((c) => c.n > 0).map((c) => c.kind));
  const systemPrompt = guideSystem({ displayName, guideName, practice, seekerFirst: SEEKER_FIRST });

  const userMessage = `${displayName} has done ${totalReadings} tarot reading${totalReadings !== 1 ? "s" : ""} in total.

${recurringCards.length > 0 ? `Cards that have appeared more than once across their readings: ${recurringCards.join(", ")}.` : ""}
${dominantSuit && suitFrequency[dominantSuit as keyof typeof suitFrequency] > 2 ? `The suit of ${dominantSuit} has been prominent in their practice.` : ""}

## Current Reading
${currentReadingBlock}

${historyBlocks.length > 0 ? `## Reading History\n${historyBlocks.join("\n\n")}` : ""}

${crossToolText(cross)}

Based on everything you have witnessed across their practice, offer 3–4 reflective questions or gentle invitations for ${displayName} to sit with.`;

  const access = await claudeAccess(session.userId, "guide");
  if (!access.ok) return access.response;
  const client = access.client;

  const model = process.env.GUIDE_MODEL ?? process.env.INTERPRET_MODEL ?? "claude-haiku-4-5";

  const stream = await client.messages.stream({
    model,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return streamClaude(stream, "guide");
}

/**
 * The guide for a reading with any tool but tarot: the reading and the person's other readings with every tool (tarot too), all in their own words.
 * Nothing is saved here; the page's Save button files it with the reading (POST /api/divinations/[id]/guide).
 */
async function guideOtherKind(userId: number, divinationId: number, kind: DivinationKind, displayName: string, guideName: string | null): Promise<Response> {
  const current = await buildContextFor(userId, { divinationId }, "questions");
  if (!current) return Response.json({ error: `The guide cannot read this ${DIVINATION_KIND_LABELS[kind] ?? "reading"} reading.` }, { status: 404 });

  const cross = await loadCrossTool(userId, { excludeDivinationId: divinationId, withTarot: true });
  const total = cross.counts.reduce((n, c) => n + c.n, 0);
  const practice = practiceWords(cross.counts.filter((c) => c.n > 0).map((c) => c.kind));
  const systemPrompt = guideSystem({ displayName, guideName, practice, seekerFirst: "Journal entries and notes are the seeker's own words. Mirror the seeker's language." });

  const userMessage = `${displayName} has done ${total} reading${total !== 1 ? "s" : ""} in total.

## Current reading (${DIVINATION_KIND_LABELS[kind]})
${current.text}

${crossToolText(cross)}

Based on everything you have witnessed across their practice, offer 3–4 reflective questions or gentle invitations for ${displayName} to sit with.`;

  const access = await claudeAccess(userId, "guide");
  if (!access.ok) return access.response;

  const stream = await access.client.messages.stream({
    model: process.env.GUIDE_MODEL ?? process.env.INTERPRET_MODEL ?? "claude-haiku-4-5",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return streamClaude(stream, "guide");
}
