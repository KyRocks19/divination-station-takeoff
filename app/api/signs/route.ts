import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { skyAt } from "@/lib/sky";
import { insertDivination } from "@/lib/divinations";
import { MAX_NOTE_CHARS, cleanDay, cleanNoteBody, isNoteType, listNotes, loadNote, noteSummary } from "@/lib/signs";

// The person's notes, newest first.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listNotes(session.userId));
}

// Saves a note of a sign or a dream. Body: { type: "sign" | "dream", body, day?: "YYYY-MM-DD", tz? }. Nothing is picked by chance and nothing is interpreted.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  if (!isNoteType(body?.type)) return Response.json({ error: "type must be sign or dream" }, { status: 400 });
  const text = cleanNoteBody(body?.body);
  if (text === null) return Response.json({ error: `Write something, up to ${MAX_NOTE_CHARS} characters.` }, { status: 400 });
  const day = cleanDay(body?.day);
  if (day === undefined) return Response.json({ error: "day must be a real date written YYYY-MM-DD" }, { status: 400 });

  const prefs = await getPrefs(userId);
  const sky = skyAt(new Date(), { tz: typeof body?.tz === "string" ? body.tz : null, hemisphere: prefs.hemisphere });

  const id = await withTransaction(async (client) => {
    const divinationId = await insertDivination(client, {
      userId,
      kind: "signs",
      question: null,
      summary: noteSummary(body.type, text),
      sky: JSON.stringify(sky),
    });
    await client.query("INSERT INTO sign_notes (user_id, divination_id, note_type, body, happened_on) VALUES ($1, $2, $3, $4, $5)", [userId, divinationId, body.type, text, day]);
    return divinationId;
  });

  return Response.json(await loadNote(userId, id), { status: 201 });
}
