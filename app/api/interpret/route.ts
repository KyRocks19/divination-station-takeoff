import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  formatSpreadContext,
  meaningLines,
  cardIdsOf,
  journalAuthorLabel,
  SEEKER_FIRST,
  type DrawnCard,
  type ClarifierMap,
} from "@/lib/reading-context";
import { loadPersonalMeanings } from "@/lib/personal-meanings";
import { jsonBody } from "@/lib/own-http";


// "questions" is the default: Hiero reflects the seeker's words back and asks. An interpretation is
// only written when the seeker asks for one.
type Mode = "questions" | "interpret";

const HIERO = `You are Hiero — a companion sitting beside the seeker for this reading. You know the tradition of the Pixie-Smith deck (Pamela Colman Smith's 1909 tarot) well: the symbols, the numerology, the elements, the mythic threads. You keep that knowledge in your pocket. The seeker's own reading of the card is the one that matters, and your work is to help them hear it.`;

const SYSTEM: Record<Mode, string> = {
  questions: `${HIERO}

First, in one or two sentences, reflect back what the seeker has already said about this card — their impression in this reading, their own meaning for it, or how they described it in earlier readings — using their words. If they have written nothing about it yet, describe what is plainly visible in the image, without saying what it means.

Then ask 2–3 open questions, each on its own line. Make them specific to this card, its position, the cards around it, and the seeker's question. Each should be answerable in many ways.

Do not offer an interpretation. Do not say what the card means. No preamble. No closing.

${SEEKER_FIRST}`,
  interpret: `${HIERO}

The seeker has asked you for possible readings. Offer exactly three — distinct angles, not variations on one idea. Number them 1, 2, 3. Each is 1–3 sentences, shaped by the card's position and the spread around it. Build first from the seeker's own meaning for the card and from what they have written in this reading and earlier ones. Use tradition only to add an angle they have not named, and say so when you do ("traditionally…").

Do not pick one as the most true. Finish with a single question that hands the choice back to the seeker. No preamble. No closing.

${SEEKER_FIRST}`,
};

export async function POST(request: NextRequest) {
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { reading_id, card_index, clarifier_index, mode: requestedMode } = sent;
  if (reading_id == null || card_index == null) {
    return Response.json({ error: "reading_id and card_index required" }, { status: 400 });
  }
  const mode: Mode = requestedMode === "interpret" ? "interpret" : "questions";

  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const reading = await queryOne(
    "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
    [reading_id, session.userId]
  ) as any;
  if (!reading) return Response.json({ error: "Reading not found" }, { status: 404 });

  const cards: DrawnCard[] = JSON.parse(reading.cards);
  const focusCard = cards[card_index];
  if (!focusCard) return Response.json({ error: "Card index out of range" }, { status: 400 });

  const allClarifiers: ClarifierMap = reading.clarifiers ? JSON.parse(reading.clarifiers) : {};
  const positionClarifiers = allClarifiers[card_index] ?? [];
  const clarifierCard = clarifier_index != null ? positionClarifiers[clarifier_index] : null;
  if (clarifier_index != null && !clarifierCard) {
    return Response.json({ error: "Clarifier card not found" }, { status: 400 });
  }
  const subject = clarifierCard ?? focusCard;

  const personal = await loadPersonalMeanings(session.userId, cardIdsOf(reading));

  const journals = await query(
    `SELECT author, content, kind, card_index, clarifier_index, created_at FROM journals
     WHERE reading_id = $1 ORDER BY created_at ASC`,
    [reading_id]
  ) as { author: string; content: string; kind: string | null; card_index: number | null; clarifier_index: number | null; created_at: string }[];

  // What the seeker wrote about this same card in other readings.
  const earlierWords = await query(
    `SELECT j.content, j.created_at, r.title, r.spread_name
     FROM journals j JOIN readings r ON r.id = j.reading_id
     WHERE r.user_id = $1 AND j.author = 'user' AND j.card_id = $2 AND j.reading_id <> $3
     ORDER BY j.created_at DESC LIMIT 5`,
    [session.userId, subject.card_id, reading_id]
  ) as { content: string; created_at: string; title: string | null; spread_name: string }[];

  const cardLabel = (j: { card_index: number | null; clarifier_index: number | null }) => {
    if (j.card_index == null) return "";
    const c = cards[j.card_index];
    if (!c) return ` — position ${j.card_index + 1}`;
    return j.clarifier_index != null
      ? ` — ${c.card_name}, ${c.position} (clarifier ${j.clarifier_index + 1})`
      : ` — ${c.card_name}, ${c.position}`;
  };

  const journalSection = journals.length > 0
    ? `\n\n**Journal entries on this reading so far:**\n${journals
        .map((j) => `[${journalAuthorLabel(j.author, j.kind)}${cardLabel(j)}]\n${j.content}`)
        .join("\n\n")}`
    : "";

  const earlierSection = earlierWords.length > 0
    ? `\n\n**What the seeker wrote when ${subject.card_name} appeared in earlier readings:**\n${earlierWords
        .map((e) => `[${new Date(e.created_at).toLocaleDateString()}, ${e.title || e.spread_name}]\n${e.content}`)
        .join("\n\n")}`
    : "";

  const describe = (c: DrawnCard) =>
    `${c.card_name} (${c.reversed ? "reversed" : "upright"})${meaningLines(c, personal, "  ")}`;

  let focus = `**The card in focus:**\nPosition: ${focusCard.position}\n${describe(focusCard)}`;
  if (positionClarifiers.length > 0) {
    focus += `\n\n**Clarifiers drawn for this position:**\n${positionClarifiers
      .map((c, i) => `${i + 1}. ${describe(c)}`)
      .join("\n")}`;
  }
  if (clarifierCard) {
    focus += `\n\n**The clarifier in focus:** ${clarifierCard.card_name}, as it clarifies ${focusCard.card_name} in the ${focusCard.position} position.`;
  }

  const ask = mode === "interpret"
    ? `Please offer three possible readings of ${subject.card_name} here, then one question back to me.`
    : `Please reflect back what I have said about ${subject.card_name}, then ask me your questions.`;

  const userPrompt = `**Spread:** ${reading.spread_name}${reading.title ? `\n**Title:** ${reading.title}` : ""}${reading.question ? `\n**Question / Intention:** ${reading.question}` : ""}

**All cards in the spread:**
${formatSpreadContext(cards, allClarifiers, personal)}

${focus}${journalSection}${earlierSection}

${ask}`;

  const access = await claudeAccess(session.userId, "interpret");
  if (!access.ok) return access.response;
  const client = access.client;

  const model = process.env.INTERPRET_MODEL ?? "claude-haiku-4-5";

  const stream = await client.messages.stream({
    model,
    max_tokens: mode === "interpret" ? 1536 : 768,
    system: SYSTEM[mode],
    messages: [{ role: "user", content: userPrompt }],
  });

  return streamClaude(stream, "interpret");
}
