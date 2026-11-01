import { getSession } from "@/lib/session";
import { shareState, turnOff, turnOn } from "@/lib/remoteview-share";

// Whether the person shares trial facts, and how many are kept under their code.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await shareState(session.userId));
}

// Turns sharing on. Only the person can do this, from the screen that lists exactly what is kept.
export async function POST() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await turnOn(session.userId);
  return Response.json(await shareState(session.userId));
}

// Turns sharing off and deletes every fact kept under the person's code.
export async function DELETE() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await turnOff(session.userId);
  return Response.json(await shareState(session.userId));
}
