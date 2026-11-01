import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import {
  askCircleInstead,
  cleanLetter,
  cleanReply,
  cleanWriteBackOn,
  declineLetter,
  deleteLetter,
  markReplySeen,
  openLetter,
  parseAction,
  putBackLetter,
  replyToLetter,
  sealLetter,
  setWriteBackOn,
  takeLetter,
} from "@/lib/letters";

// One step on one letter. Body: { action, ... }:
//   take, put_back, decline (the reader); ask_circle, open, write_back_on { day }, reply { text } (the asker); seal { letter, divination_id? }
//   (the reader); reply_seen (the reader). Each step checks the person's place in the letter in the database; anything else is "Not found".
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = toId((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const action = parseAction(body?.action);
  if (!action) return Response.json({ error: "Unknown action" }, { status: 400 });
  const userId = session.userId;

  let ok = false;
  switch (action) {
    case "take":
      ok = await takeLetter(userId, id);
      break;
    case "put_back":
      ok = await putBackLetter(userId, id);
      break;
    case "decline":
      ok = await declineLetter(userId, id);
      break;
    case "ask_circle":
      ok = await askCircleInstead(userId, id);
      break;
    case "open":
      ok = await openLetter(userId, id);
      break;
    case "reply_seen":
      ok = await markReplySeen(userId, id);
      break;
    case "write_back_on": {
      const day = cleanWriteBackOn(body?.day);
      if (day === undefined) return Response.json({ error: "The day must be a date like 2026-12-31." }, { status: 400 });
      ok = await setWriteBackOn(userId, id, day);
      break;
    }
    case "reply": {
      const text = cleanReply(body?.text);
      if (!text.ok) return Response.json({ error: text.error }, { status: 400 });
      ok = await replyToLetter(userId, id, text.text);
      break;
    }
    case "seal": {
      const letter = cleanLetter(body?.letter);
      if (!letter.ok) return Response.json({ error: letter.error }, { status: 400 });
      const raw = body?.divination_id;
      const divinationId = raw === null || raw === undefined || raw === "" ? null : toId(raw);
      if (divinationId === 0) return Response.json({ error: "That reading was not found." }, { status: 400 });
      const sealed = await sealLetter(userId, id, letter.text, divinationId);
      if (!sealed.ok && sealed.problem === "reading_not_found") {
        return Response.json({ error: "Choose one of your own readings from the last two weeks, or none." }, { status: 400 });
      }
      ok = sealed.ok;
      break;
    }
  }
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

// The asker deletes the whole letter; a reader puts back a letter they have not sealed, or takes a sealed one off their own list.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = toId((await params).id);
  if (!id || !(await deleteLetter(session.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
