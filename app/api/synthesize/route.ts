import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { idList } from "@/lib/limits";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatReadingForClaude, cardIdsOf, journalAuthorLabel, SEEKER_FIRST } from "@/lib/reading-context";
import { loadPersonalMeanings } from "@/lib/personal-meanings";
import { jsonBody } from "@/lib/own-http";

export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const prompt = body.prompt;
  const reading_ids = idList(body.reading_ids, 20);
  const journal_ids = idList(body.journal_ids, 30);
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > 4000) {
    return Response.json({ error: "That question is too long (4,000 characters)" }, { status: 400 });
  }
  if (!reading_ids.length && !journal_ids.length) {
    return Response.json({ error: "At least one reading or journal entry must be selected" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const readingBlocks: string[] = [];
  for (const rid of reading_ids as number[]) {
    const reading = await queryOne(
      "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
      [rid, session.userId!]
    ) as any;
    if (!reading) continue;

    const journals = await query(
      "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
      [rid]
    ) as any[];

    const personal = await loadPersonalMeanings(session.userId!, cardIdsOf(reading));
    readingBlocks.push(formatReadingForClaude(reading, journals, personal));
  }

  const journalBlocks: string[] = [];
  for (const jid of journal_ids as number[]) {
    const row = await queryOne(`
      SELECT j.*, r.title, r.spread_name, r.question
      FROM journals j
      JOIN readings r ON r.id = j.reading_id
      WHERE j.id = $1 AND r.user_id = $2
    `, [jid, session.userId!]) as any;
    if (!row) continue;
    if ((reading_ids as number[]).includes(row.reading_id)) continue;

    journalBlocks.push(
      `### Journal entry from: ${row.title || row.spread_name}${row.question ? ` — "${row.question}"` : ""}\n` +
      `Author: ${journalAuthorLabel(row.author, row.kind)} · ${new Date(row.created_at).toLocaleDateString()}\n` +
      row.content,
    );
  }

  const allContext = [...readingBlocks, ...journalBlocks].join("\n\n---\n\n");

  const systemPrompt = `You are a thoughtful, insightful tarot reader and reflective guide. You help the querent find deeper meaning and connections across their tarot readings and journal entries. Speak with warmth, depth, and specificity — draw on the actual cards, patterns, and words from the provided context rather than speaking in generalities. You are continuing an ongoing reflective practice with this person.

${SEEKER_FIRST}`;

  const userPrompt = `I'd like to reflect on some of my tarot readings and journal entries together. Here is the context I'm drawing from:

${allContext}

---

My question or reflection:
${prompt}`;

  const access = await claudeAccess(session.userId, "synthesize");
  if (!access.ok) return access.response;
  const client = access.client;

  const model = process.env.INTERPRET_MODEL ?? "claude-haiku-4-5";

  const stream = await client.messages.stream({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return streamClaude(stream, "synthesize");
}
