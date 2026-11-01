import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { OUTCOMES, cleanCheckOn, cleanPredictionText, deletePrediction, updatePrediction, type Outcome, type PredictionChange } from "@/lib/predictions";

// Changes one prediction: reword it, move its date, or record what happened. Body fields (all optional):
// text, check_on (a date or null), outcome ("yes" | "partly" | "no" | "unclear", or null to take it back), outcome_note.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = toId((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Bad request" }, { status: 400 });

  const change: PredictionChange = {};
  if ("text" in body) {
    const text = cleanPredictionText(body.text);
    if (!text.ok) return Response.json({ error: text.error }, { status: 400 });
    change.text = text.text;
  }
  if ("check_on" in body) {
    const d = cleanCheckOn(body.check_on);
    if (d === undefined) return Response.json({ error: "check_on must be a date like 2026-12-31" }, { status: 400 });
    change.checkOn = d;
  }
  if ("outcome" in body) {
    if (body.outcome !== null && !OUTCOMES.includes(body.outcome)) return Response.json({ error: "outcome must be yes, partly, no, unclear, or null" }, { status: 400 });
    change.outcome = body.outcome as Outcome | null;
  }
  if ("outcome_note" in body) {
    const note = typeof body.outcome_note === "string" ? body.outcome_note.trim() : "";
    if (note.length > 2000) return Response.json({ error: "That note is too long (2,000 characters at most)." }, { status: 400 });
    change.outcomeNote = note || null;
  }
  const row = await updatePrediction(session.userId, id, change);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = toId((await params).id);
  if (!id || !(await deletePrediction(session.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
