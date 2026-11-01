import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { bodyOf, idParam } from "@/lib/own-http";
import { cleanConfidence, cleanFit, cleanFitNote, cleanGuessText, cleanLogicText } from "@/lib/guess-core";
import { deleteGuess, getGuess, guessStepOn, sealGuess, setCompanionOk, setFit } from "@/lib/guesses";

// The guess a person writes before a reading's meanings are opened (open item: predict before you look). GET: what is there and whether the step
// is on. PUT: seal a guess ({ guess, confidence: 1 to 5 or null, logic: what the logical mind said, optional }) or set the step aside for this reading ({ skip: true }); the first one stands.
// PATCH: say how well a written guess fitted ({ fit: 1 to 5 or null, note }), or tick whether the companion may read it ({ companion_ok }, migration
// 092; never on by default). DELETE: forget the guess. Only the reading's owner, for a reading of any tool.
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const [guess, on] = await Promise.all([getGuess(session.userId, id), guessStepOn(session.userId)]);
  return Response.json({ step_on: on, guess });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await bodyOf(request)) as { guess?: unknown; skip?: unknown; confidence?: unknown; logic?: unknown } | null;
  const confidence = cleanConfidence(body?.confidence);
  if (confidence === undefined) return Response.json({ error: "Choose how sure you feel, from 1 to 5, or leave it out." }, { status: 400 });
  const logic = cleanLogicText(body?.logic);
  if (logic === undefined) return Response.json({ error: "What your logical mind says is too long." }, { status: 400 });
  let text: string | null = null;
  if (body?.skip !== true) {
    const clean = cleanGuessText(body?.guess);
    if (!clean.ok) return Response.json({ error: clean.error }, { status: 400 });
    text = clean.text;
  }
  const guess = await sealGuess(session.userId, id, text, confidence, logic);
  if (!guess) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ guess });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await bodyOf(request)) as { fit?: unknown; note?: unknown; companion_ok?: unknown } | null;
  if (body && "companion_ok" in body && !("fit" in body)) {
    if (typeof body.companion_ok !== "boolean") return Response.json({ error: "companion_ok must be true or false" }, { status: 400 });
    const guess = await setCompanionOk(session.userId, id, body.companion_ok);
    if (!guess) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ guess });
  }
  const fit = cleanFit(body?.fit);
  if (fit === undefined) return Response.json({ error: "Choose how well it fitted, from 1 to 5." }, { status: 400 });
  const note = cleanFitNote(body?.note);
  if (note === undefined) return Response.json({ error: "That note is too long." }, { status: 400 });
  const guess = await setFit(session.userId, id, fit, note);
  if (!guess) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ guess });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await deleteGuess(session.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
