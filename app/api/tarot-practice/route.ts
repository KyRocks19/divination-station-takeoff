import { getSession } from "@/lib/session";
import { clearTrials, listTrials, sealedTrial } from "@/lib/tarot-practice";

// Tarot practice with a sealed card (migration 092). GET: the person's guessed trials and their numbers. POST: the sealed card waiting for a
// guess (or a new one); only its id is returned. DELETE: forget every trial. Only the person's own.

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listTrials(session.userId));
}

export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ id: await sealedTrial(session.userId) });
}

export async function DELETE() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ deleted: await clearTrials(session.userId) });
}
