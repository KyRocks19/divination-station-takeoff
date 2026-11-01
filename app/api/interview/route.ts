import { NextRequest } from "next/server";
import { aiFailure } from "@/lib/ai-log";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatSpreadContext, cardIdsOf, journalAuthorLabel, SEEKER_FIRST, type DrawnCard, type ClarifierMap } from "@/lib/reading-context";
import { loadPersonalMeanings } from "@/lib/personal-meanings";
import { buildContextFor } from "@/lib/companion-subject";
import { divinationKind } from "@/lib/companion-context-tools";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import { INTERVIEW_AUTHOR, cleanQa, interpretSystem, interpretUser, isOtherKind, parseQuestions, questionsSystem, questionsUser, savedInterview } from "@/lib/interview-prompts";
import { jsonBody } from "@/lib/own-http";

// The interviewer. Body: { reading_id | divination_id, phase: "questions" | "interpret", qa? }.
// `reading_id` is a tarot reading. `divination_id` is the shared record of any reading: a tarot one is answered as its tarot reading, every other
// kind (oracle pulls, runes, ogham, dice, pendulum, scrying) by interviewOtherKind below, which is given only what the person wrote.
export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const { phase, qa } = body;
  let reading_id = body.reading_id;
  const divination_id = body.divination_id;
  if ((!reading_id && !divination_id) || !phase) {
    return Response.json({ error: "reading_id (or divination_id) and phase required" }, { status: 400 });
  }

  if (qa !== undefined && (!Array.isArray(qa) || qa.length > 8 || JSON.stringify(qa).length > 16000)) {
    return Response.json({ error: "qa must be at most 8 short questions and answers" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!reading_id) {
    const id = Number(divination_id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "divination_id is not valid" }, { status: 400 });
    const kind = await divinationKind(session.userId, id);
    if (!kind) return Response.json({ error: "Reading not found" }, { status: 404 });
    if (isOtherKind(kind)) return interviewOtherKind(session.userId, id, kind, phase, qa);
    // A tarot reading's shared record points at its tarot reading.
    const tarot = await queryOne<{ reading_id: number | null }>("SELECT reading_id FROM divinations WHERE id = $1 AND user_id = $2", [id, session.userId]);
    if (!tarot?.reading_id) return Response.json({ error: "Reading not found" }, { status: 404 });
    reading_id = tarot.reading_id;
  }

  const reading = await queryOne(
    "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
    [reading_id, session.userId!]
  ) as any;
  if (!reading) return Response.json({ error: "Reading not found" }, { status: 404 });

  const cards: DrawnCard[] = JSON.parse(reading.cards);
  const clarifiers: ClarifierMap = reading.clarifiers ? JSON.parse(reading.clarifiers) : {};
  const personal = await loadPersonalMeanings(session.userId!, cardIdsOf(reading));
  const spreadContext = formatSpreadContext(cards, clarifiers, personal);

  const readingHeader = `**Spread:** ${reading.spread_name}${reading.title ? `\n**Title:** ${reading.title}` : ""}${reading.question ? `\n**Question / Intention:** ${reading.question}` : ""}

**Cards:**
${spreadContext}`;

  const access = await claudeAccess(session.userId, `interview ${phase}`);
  if (!access.ok) return access.response;
  const client = access.client;

  const model = process.env.INTERPRET_MODEL ?? "claude-haiku-4-5";

  if (phase === "questions") {
    const systemPrompt = `You are Hiero — a tarot reader steeped in the tradition of the Pixie-Smith deck (Pamela Colman Smith's 1909 tarot). Before offering an interpretation, you want to understand the seeker's relationship to this reading. Generate 2–4 focused, open-ended questions that will help you interpret the cards in the context of their actual life and experience. Questions should be specific to what these cards are showing, not generic. Where the seeker has written their own meaning for a card, ask from inside that meaning. Return ONLY a valid JSON array of question strings — no explanation, no markdown, just the array.

${SEEKER_FIRST}`;

    const userPrompt = `${readingHeader}

Generate 2–4 interview questions for this seeker. Return only a JSON array of strings.`;

    let response: Awaited<ReturnType<typeof client.messages.create>>;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (err) {
      return aiFailure("interview questions", err);
    }

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return Response.json({ error: "Failed to generate questions" }, { status: 500 });
    }

    try {
      const questions = JSON.parse(match[0]);
      return Response.json({ questions });
    } catch {
      return Response.json({ error: "Failed to parse questions" }, { status: 500 });
    }
  }

  if (phase === "interpret") {
    if (!qa || !Array.isArray(qa)) {
      return Response.json({ error: "qa array required for interpret phase" }, { status: 400 });
    }

    const journals = await query(
      `SELECT author, content, kind FROM journals WHERE reading_id = $1 ORDER BY created_at ASC`,
      [reading_id]
    ) as { author: string; content: string; kind: string | null }[];

    const priorSection = journals.length > 0
      ? `\n\n**Prior journal entries:**\n${journals.map((j) => `[${journalAuthorLabel(j.author, j.kind)}]: ${j.content}`).join("\n\n")}`
      : "";

    const qaText = (qa as { question: string; answer: string }[])
      .map((item, i) => `Q${i + 1}: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");

    const systemPrompt = `You are Hiero — a reader steeped in the tradition of the Pixie-Smith deck (Pamela Colman Smith's 1909 tarot). You have just interviewed the seeker and now offer your interpretation. Weave together the cards, their positions, and what the seeker shared. Be specific, personal, and grounded in what you see in the images and in what they told you. Build from the seeker's answers and their own meanings for the cards before anything from tradition. End with one open question that hands the reading back to them. No preamble. No closing pleasantries.

${SEEKER_FIRST}`;

    const userPrompt = `${readingHeader}${priorSection}

**Interview with the seeker:**
${qaText}

Offer your interpretation of this reading in light of what the seeker shared.`;

    const stream = await client.messages.stream({
      model,
      max_tokens: 1536,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    return streamClaude(stream, "interview", async (fullContent) => {
      const qaFormatted = (qa as { question: string; answer: string }[])
        .map((item) => `**${item.question}**\n${item.answer}`)
        .join("\n\n");
      const savedContent = `${qaFormatted}\n\n---\n\n${fullContent}`;
      await query(
        `INSERT INTO journals (reading_id, author, content) VALUES ($1, 'interview', $2)`,
        [reading_id, savedContent]
      );
    });
  }

  return Response.json({ error: "Invalid phase" }, { status: 400 });
}

/**
 * The interviewer for a reading of any kind but tarot. It is told only the person's own words (lib/companion-context*.ts builds the text and
 * labels each line as theirs), never a stock meaning, and what it writes is saved apart from the person's own writing: its journal rows carry
 * the author "interview" and a divination_id, and everything that reads the person's own words (the companion, Patterns, search, "what has
 * changed") reads only author "user".
 */
async function interviewOtherKind(userId: number, divinationId: number, kind: string, phase: unknown, qaRaw: unknown): Promise<Response> {
  if (!isOtherKind(kind)) return Response.json({ error: "Reading not found" }, { status: 404 });
  if (phase !== "questions" && phase !== "interpret") return Response.json({ error: "Invalid phase" }, { status: 400 });
  const qa = phase === "interpret" ? cleanQa(qaRaw) : null;
  if (phase === "interpret" && !qa) return Response.json({ error: "qa array required for interpret phase" }, { status: 400 });

  const context = await buildContextFor(userId, { divinationId }, "questions");
  if (!context) return Response.json({ error: `The interviewer cannot read this ${DIVINATION_KIND_LABELS[kind]} reading.` }, { status: 404 });

  const access = await claudeAccess(userId, `interview-${kind} ${phase}`);
  if (!access.ok) return access.response;
  const client = access.client;
  const model = process.env.INTERPRET_MODEL ?? "claude-haiku-4-5";

  if (phase === "questions") {
    let text: string;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 512,
        system: questionsSystem(kind),
        messages: [{ role: "user", content: questionsUser(context.text) }],
      });
      text = response.content[0]?.type === "text" ? response.content[0].text : "";
    } catch (err) {
      return aiFailure(`interview-${kind} questions`, err);
    }
    const questions = parseQuestions(text);
    if (!questions) return Response.json({ error: "Claude did not write usable questions just now. Nothing was saved. Try again." }, { status: 500 });
    return Response.json({ questions });
  }

  const stream = await client.messages.stream({
    model,
    max_tokens: 1536,
    system: interpretSystem(kind),
    messages: [{ role: "user", content: interpretUser(context.text, qa!) }],
  });
  return streamClaude(stream, `interview-${kind}`, async (reading) => {
    await query("INSERT INTO journals (divination_id, author, content) VALUES ($1, $2, $3)", [divinationId, INTERVIEW_AUTHOR, savedInterview(qa!, reading)]);
  });
}
