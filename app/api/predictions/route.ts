import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import {
  MAX_OPEN_PREDICTIONS,
  cleanCheckOn,
  cleanPredictionText,
  countOpen,
  createPrediction,
  divinationForReading,
  listForDivination,
  ownsDivination,
} from "@/lib/predictions";

// A person's predictions about one reading of any tool. Name the reading with ?divination_id=, or for a tarot reading ?reading_id=.
async function readingFor(userId: number, divinationId: unknown, readingId: unknown): Promise<number | null> {
  if (divinationId !== undefined && divinationId !== null && divinationId !== "") {
    const id = toId(String(divinationId));
    return id && (await ownsDivination(userId, id)) ? id : null;
  }
  if (readingId !== undefined && readingId !== null && readingId !== "") {
    const id = toId(String(readingId));
    return id ? divinationForReading(userId, id) : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = request.nextUrl.searchParams;
  const divinationId = await readingFor(session.userId, p.get("divination_id"), p.get("reading_id"));
  if (!divinationId) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await listForDivination(session.userId, divinationId));
}

// Body: { divination_id | reading_id, text, check_on? }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const divinationId = await readingFor(session.userId, body?.divination_id, body?.reading_id);
  if (!divinationId) return Response.json({ error: "Not found" }, { status: 404 });
  const text = cleanPredictionText(body?.text);
  if (!text.ok) return Response.json({ error: text.error }, { status: 400 });
  const checkOn = cleanCheckOn(body?.check_on);
  if (checkOn === undefined) return Response.json({ error: "check_on must be a date like 2026-12-31" }, { status: 400 });
  if ((await countOpen(session.userId)) >= MAX_OPEN_PREDICTIONS) {
    return Response.json({ error: `You have ${MAX_OPEN_PREDICTIONS} predictions still waiting. Look back on some before adding more.` }, { status: 400 });
  }
  return Response.json(await createPrediction(session.userId, divinationId, text.text, checkOn), { status: 201 });
}
