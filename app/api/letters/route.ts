import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { divinationForReading, ownsDivination } from "@/lib/predictions";
import { askLetter, askableMembers, cleanQuestion, lettersForReading, listLetters, parseRecipient, readingChoices, MAX_WAITING_QUESTIONS } from "@/lib/letters";

// The signed-in person's letters (migration 103). With ?divination_id= or, for a tarot reading, ?reading_id=: only the letters they sent
// about that reading of their own, for the reading's page. Without: everything for the Letters page, with the members they may ask and
// their own recent readings to choose from.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = request.nextUrl.searchParams;
  if (p.has("divination_id") || p.has("reading_id")) {
    let divinationId: number | null = null;
    if (p.has("divination_id")) {
      const id = toId(p.get("divination_id"));
      divinationId = id && (await ownsDivination(session.userId, id)) ? id : null;
    } else {
      const id = toId(p.get("reading_id"));
      divinationId = id ? await divinationForReading(session.userId, id) : null;
    }
    if (!divinationId) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ letters: await lettersForReading(session.userId, divinationId) });
  }
  const [letters, members, readings] = await Promise.all([listLetters(session.userId), askableMembers(session.userId), readingChoices(session.userId)]);
  return Response.json({ letters, members, readings });
}

// Asks a question. Body: { question, to: "circle" | <member id>, blind?: boolean }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const question = cleanQuestion(body?.question);
  if (!question.ok) return Response.json({ error: question.error }, { status: 400 });
  const to = parseRecipient(body?.to);
  if (!to) return Response.json({ error: "Choose who to ask: one member, or your whole circle." }, { status: 400 });
  const result = await askLetter(session.userId, question.text, to, body?.blind === true);
  if (!result.ok) {
    if (result.problem === "no_circle") return Response.json({ error: "Letters are between members of a circle. Join or make one first." }, { status: 403 });
    if (result.problem === "not_in_circle") return Response.json({ error: "That person is not in your circle." }, { status: 400 });
    return Response.json({ error: `You have ${MAX_WAITING_QUESTIONS} questions still waiting for a letter. Delete one, or wait for a letter, before asking another.` }, { status: 400 });
  }
  return Response.json({ id: result.id }, { status: 201 });
}
