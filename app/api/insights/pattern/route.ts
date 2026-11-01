import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TAROT_DECK } from "@/lib/cards";
import { loadPersonalMeanings } from "@/lib/personal-meanings";
import { SEEKER_FIRST } from "@/lib/reading-context";
import { loadCrossTool } from "@/lib/guide-context";
import { OWN_WORDS_ONLY, PATTERN_OTHER_TOOLS, crossToolText } from "@/lib/guide-prompts";

// The pattern reading across everything the person has done (open item Y3, 2026-10-18): the tarot history as before, and beside it their readings
// with every other tool, given as counts, the names of what keeps coming up, and their own words only.
export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const totals = await queryOne(
    `SELECT COUNT(DISTINCT reading_id) AS total_readings,
            MIN(created_at) AS first_reading,
            MAX(created_at) AS last_reading
     FROM card_draws WHERE user_id = $1 AND is_clarifier = 0`,
    [userId]
  ) as any;

  const hasTarot = !!totals && Number(totals.total_readings) > 0;
  const cross = await loadCrossTool(userId, { withTarot: false, limit: 6 });
  const crossText = crossToolText(cross);
  if (!hasTarot && !crossText) {
    return Response.json({ error: "No readings to analyze yet" }, { status: 400 });
  }
  if (!hasTarot) return patternOtherTools(userId, crossText);

  const topCards = await query(
    `SELECT cd.card_id, cd.card_name,
            COUNT(*)              AS total,
            SUM(cd.reversed)      AS reversed_count,
            COUNT(*) - SUM(cd.reversed) AS upright_count,
            STRING_AGG(DISTINCT cd.position_name, ',') AS positions,
            STRING_AGG(DISTINCT cd.spread_name, ',')   AS spreads
     FROM card_draws cd
     WHERE cd.user_id = $1 AND cd.is_clarifier = 0
     GROUP BY cd.card_id, cd.card_name
     HAVING COUNT(*) >= 2
     ORDER BY total DESC
     LIMIT 12`,
    [userId]
  ) as any[];

  const recentReadings = await query(
    `SELECT title, question, spread_name, created_at
     FROM readings
     WHERE user_id = $1 AND question IS NOT NULL AND question != ''
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId]
  ) as any[];

  const suitRows = await query(
    `SELECT
       CASE
         WHEN card_id LIKE 'major-%'     THEN 'Major Arcana'
         WHEN card_id LIKE 'cups-%'      THEN 'Cups'
         WHEN card_id LIKE 'wands-%'     THEN 'Wands'
         WHEN card_id LIKE 'swords-%'    THEN 'Swords'
         WHEN card_id LIKE 'pentacles-%' THEN 'Pentacles'
       END AS suit,
       COUNT(*) AS count
     FROM card_draws WHERE user_id = $1 AND is_clarifier = 0
     GROUP BY suit ORDER BY count DESC`,
    [userId]
  ) as any[];

  const clarified = await query(
    `SELECT clarifies_card_id, MAX(clarifies_position) AS position_name, COUNT(*) AS times
     FROM card_draws WHERE user_id = $1 AND is_clarifier = 1
     GROUP BY clarifies_card_id ORDER BY times DESC LIMIT 5`,
    [userId]
  ) as any[];

  const personal = await loadPersonalMeanings(userId, topCards.map((c: any) => c.card_id));

  // The seeker's own recent words: notes, first impressions, and look-backs.
  const ownWords = await query(
    `SELECT j.content, j.kind, j.created_at, r.title, r.spread_name
     FROM journals j JOIN readings r ON r.id = j.reading_id
     WHERE r.user_id = $1 AND j.author = 'user'
     ORDER BY j.created_at DESC LIMIT 20`,
    [userId]
  ) as { content: string; kind: string | null; created_at: string; title: string | null; spread_name: string }[];

  const dateRange = `${new Date(totals.first_reading).toLocaleDateString()} to ${new Date(totals.last_reading).toLocaleDateString()}`;

  const cardSummaryLines = topCards.map((c: any) => {
    const card = TAROT_DECK.find((t) => t.id === c.card_id);
    const mostlyReversed = Number(c.reversed_count) > Number(c.upright_count);
    const meaning = card ? (mostlyReversed ? card.reversedMeaning : card.uprightMeaning) : "";
    const mine = personal[c.card_id];
    const own = mine
      ? (mostlyReversed ? [mine.reversedKeywords, mine.reversedDescription] : [mine.uprightKeywords, mine.uprightDescription]).filter(Boolean).join(" — ")
      : "";
    const reversalNote =
      Number(c.reversed_count) > 0
        ? ` — ${c.upright_count} upright, ${c.reversed_count} reversed`
        : " — always upright";
    const positions = c.positions
      ? c.positions.split(",").filter(Boolean).join("; ")
      : "various positions";
    return `- ${c.card_name}: drawn ${c.total}×${reversalNote} | positions: ${positions}${own ? ` | seeker's own meaning: "${own}"` : ""}${meaning ? ` | Pixie-Smith reference: "${meaning}"` : ""}`;
  });

  const suitSummary = suitRows.map((s: any) => `${s.suit}: ${s.count}`).join(", ");
  const questionSummary =
    recentReadings.length > 0
      ? recentReadings.map((r: any) => `"${r.question}"`).join("; ")
      : "no explicit questions recorded";
  const clarifiedSummary =
    clarified.length > 0
      ? clarified.map((c: any) => `${c.clarifies_card_id} at ${c.position_name} (×${c.times})`).join(", ")
      : "none";

  const summaryText = [
    `Reading history: ${totals.total_readings} readings spanning ${dateRange}`,
    ``,
    `Suit distribution (spread cards only): ${suitSummary}`,
    ``,
    `Cards drawn two or more times:`,
    ...cardSummaryLines,
    ``,
    `Questions and intentions asked across readings: ${questionSummary}`,
    ``,
    `Positions most frequently clarified: ${clarifiedSummary}`,
    ...(ownWords.length > 0
      ? [
          ``,
          `The seeker's own recent journal entries (newest first):`,
          ...ownWords.map((w) => {
            const label = w.kind === "impression" ? "first impression" : w.kind === "lookback" ? "looking back" : "note";
            const text = w.content.length > 400 ? `${w.content.slice(0, 400)}…` : w.content;
            return `- [${new Date(w.created_at).toLocaleDateString()}, ${w.title || w.spread_name}, ${label}] ${text}`;
          }),
        ]
      : []),
    ...(crossText ? [``, crossText] : []),
  ].join("\n");

  const systemPrompt = `You are Hiero — a reader steeped in the tradition of the Pixie-Smith deck (Pamela Colman Smith's 1909 tarot), named for the Hierophant: the keeper of sacred knowledge, the bridge between old wisdom and the person standing before you now. You have spent a long time with the cards. You know the symbols, the numerology, the elemental dignities, the mythic threads woven through the deck. But you wear this knowledge lightly. You use it to illuminate, not to impress.

You are being asked to reflect on a person's entire reading history — not any single spread, but the threads and patterns that run through all of their readings over time. Speak to what the cards collectively reveal. Name the recurring presences and what their persistence suggests. Interpret the suit distribution as an elemental picture of where the person's energy lives — Major Arcana abundance signals a life at a crossroads; heavy Cups suggests emotional currents running deep; Swords point to mental friction or clarity sought; Wands to drive and becoming; Pentacles to the material and embodied. If certain cards anchor in recurring positions, name what that structural pattern holds. If they return again and again to the same questions, reflect that back. Be specific and grounded in the actual data. Speak with warmth but without flattery.

Where the seeker's own journal entries are included, start from them: name the words and themes they keep returning to, and how what they wrote when looking back compares with what they wrote at the time. Offer the elemental picture as one way of seeing, not as a verdict. Close with two or three open questions rather than a conclusion.

${SEEKER_FIRST}${crossText ? `\n\n${PATTERN_OTHER_TOOLS}` : ""}`;

  const userPrompt = `Please reflect on the patterns in my reading history and tell me what you see — what recurring themes, what the cards keep saying, what the elemental balance reveals${crossText ? ", and what the other tools I use add" : ""}.

${summaryText}`;

  const access = await claudeAccess(session.userId, "pattern");
  if (!access.ok) return access.response;
  const client = access.client;

  const stream = await client.messages.stream({
    model: process.env.INTERPRET_MODEL ?? "claude-haiku-4-5",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return streamClaude(stream, "pattern");
}

/** A person who has no tarot readings yet but has used other tools: the same reflection, from their own words and the names of what came up. */
async function patternOtherTools(userId: number, crossText: string): Promise<Response> {
  const systemPrompt = `You are Hiero — a quiet, attentive reader. You are being asked to reflect on a person's whole history with the divination tools they use, not any single reading: the threads and patterns that run through all of it over time. Name what keeps coming up and in whose words, notice where the same theme turns up through more than one tool, and ask what it means to them. Be specific and grounded in the actual notes. Speak with warmth but without flattery. Close with two or three open questions rather than a conclusion.

${OWN_WORDS_ONLY}`;
  const userPrompt = `Please reflect on the patterns in my reading history and tell me what you see.\n\n${crossText}`;

  const access = await claudeAccess(userId, "pattern");
  if (!access.ok) return access.response;
  const stream = await access.client.messages.stream({
    model: process.env.INTERPRET_MODEL ?? "claude-haiku-4-5",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return streamClaude(stream, "pattern");
}
