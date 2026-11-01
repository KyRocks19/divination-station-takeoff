import { NextRequest } from "next/server";
import { forumViewer } from "@/lib/forum-circles";
import { canSeePost } from "@/lib/forum-circles-core";
import { streamClaude } from "@/lib/ai-stream";
import { claudeAccess } from "@/lib/claude-access";
import { idList } from "@/lib/limits";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatReadingForClaude, cardIdsOf, journalAuthorLabel, SEEKER_FIRST } from "@/lib/reading-context";
import { loadPersonalMeanings } from "@/lib/personal-meanings";
import { maySeeHidden } from "@/lib/forum-reports";
import { jsonBody } from "@/lib/own-http";

export async function POST(request: NextRequest) {
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const { question, forum_post_id, include_tags = false } = body;
  const reading_ids = idList(body.reading_ids, 20);
  const journal_ids = idList(body.journal_ids, 30);
  const synthesis_journal_ids = idList(body.synthesis_journal_ids, 10);

  if (typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > 4000) {
    return Response.json({ error: "That question is too long (4,000 characters)" }, { status: 400 });
  }

  const session = await getSession();
  if (!session.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contextBlocks: string[] = [];

  for (const rid of reading_ids as number[]) {
    const reading = await queryOne(
      "SELECT * FROM readings WHERE id = $1 AND user_id = $2",
      [rid, session.userId]
    ) as any;
    if (!reading) continue;
    const journals = await query(
      "SELECT * FROM journals WHERE reading_id = $1 ORDER BY created_at ASC",
      [rid]
    ) as any[];
    const personal = await loadPersonalMeanings(session.userId, cardIdsOf(reading));
    contextBlocks.push(formatReadingForClaude(reading, journals, personal));
  }

  for (const jid of journal_ids as number[]) {
    const row = await queryOne(`
      SELECT j.*, r.title, r.spread_name, r.question, r.id AS reading_id
      FROM journals j
      JOIN readings r ON r.id = j.reading_id
      WHERE j.id = $1 AND r.user_id = $2
    `, [jid, session.userId]) as any;
    if (!row) continue;
    if ((reading_ids as number[]).includes(row.reading_id)) continue;
    contextBlocks.push(
      `### Journal entry from: ${row.title || row.spread_name}${row.question ? ` — "${row.question}"` : ""}\n` +
      `Author: ${journalAuthorLabel(row.author, row.kind)} · ${new Date(row.created_at).toLocaleDateString()}\n\n` +
      row.content
    );
  }

  for (const sid of synthesis_journal_ids as number[]) {
    const row = await queryOne(
      "SELECT * FROM synthesis_journals WHERE id = $1 AND user_id = $2",
      [sid, session.userId]
    ) as any;
    if (!row) continue;
    contextBlocks.push(
      `### Synthesis journal\nPrompt: ${row.prompt}\nDate: ${new Date(row.created_at).toLocaleDateString()}\n\n${row.content}`
    );
  }

  if (forum_post_id) {
    const post = await queryOne(`
      SELECT fp.*, u.username, u.display_name
      FROM forum_posts fp
      JOIN users u ON u.id = fp.user_id
      WHERE fp.id = $1
    `, [forum_post_id]) as any;
    // A post hidden after reports is not read to Claude for anyone but its author and the owner, and hidden comments are left out.
    // A post outside the person's circle is not read to Claude for them either (migration 074).
    const inCircle = post && canSeePost(await forumViewer(session.userId, !!session.isAdmin), post);
    if (post && inCircle && (!post.hidden_at || maySeeHidden(post.user_id, session.userId, !!session.isAdmin))) {
      let block = `### Forum post: "${post.title}"\nBy: ${post.display_name || post.username} · ${new Date(post.created_at).toLocaleDateString()}\n\n${post.body}`;
      const comments = await query(`
        SELECT fc.*, u.username, u.display_name
        FROM forum_comments fc
        JOIN users u ON u.id = fc.user_id
        WHERE fc.post_id = $1
        ORDER BY fc.created_at ASC
      `, [forum_post_id]).then((rows) => (rows as any[]).filter((c) => !c.hidden_at || maySeeHidden(c.user_id, session.userId!, !!session.isAdmin)));
      if (comments.length > 0) {
        block += `\n\nComments:\n` + comments.map((c: any) =>
          `  — ${c.display_name || c.username} (${new Date(c.created_at).toLocaleDateString()}): ${c.content}`
        ).join("\n");
      }
      contextBlocks.push(block);
    }
  }

  if (include_tags) {
    const tags = await query(
      "SELECT name FROM tags WHERE user_id = $1 ORDER BY name ASC",
      [session.userId]
    ) as any[];
    if (tags.length > 0) {
      contextBlocks.push(`### My tags\n${tags.map((t: any) => t.name).join(", ")}`);
    }
  }

  if (contextBlocks.length === 0) {
    return Response.json({ error: "No valid context items found — select at least one" }, { status: 400 });
  }

  const allContext = contextBlocks.join("\n\n---\n\n");

  const systemPrompt = `You are a thoughtful, insightful tarot advisor and reflective guide. You help the querent find meaning, patterns, and guidance within their tarot practice. You have access to their readings, journal entries, and community discussions as context. Speak with warmth, depth, and specificity — draw on the actual cards, symbols, and words from the provided context rather than speaking in generalities. You are a trusted companion in their ongoing reflective practice.

${SEEKER_FIRST}`;

  const userPrompt = `Here is the context I'd like you to draw from:

${allContext}

---

My question:
${question.trim()}`;

  const access = await claudeAccess(session.userId, "ask");
  if (!access.ok) return access.response;
  const client = access.client;

  const model = process.env.INTERPRET_MODEL ?? "claude-haiku-4-5";

  const stream = await client.messages.stream({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return streamClaude(stream, "ask");
}
