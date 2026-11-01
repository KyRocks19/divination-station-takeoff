import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { keepCompanionJob } from "@/lib/companion-queue";
import { idParam } from "@/lib/own-http";

// "Keep this": the companion's questions become a kept note for the reading. Only an answer of questions can be kept (never a crisis reply or a check-in).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const note = await keepCompanionJob(session.userId, toId(id));
  if (!note) return Response.json({ error: "There is nothing to keep, or this reading already has the most notes it can hold." }, { status: 404 });
  return Response.json(note, { status: 201 });
}
