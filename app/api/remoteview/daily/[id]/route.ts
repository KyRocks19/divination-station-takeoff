import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { cleanDailyChoice } from "@/lib/remoteview-core";
import { judgeDaily } from "@/lib/remoteview-daily";
import { idParam } from "@/lib/own-http";

// Records the choice for a daily trial. Body: { choice: 0 to 4 }. It can be done once. The answer shows the target and the secret number behind the seal.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const choice = cleanDailyChoice(body?.choice);
  if (choice === null) return Response.json({ error: "choice must be a whole number from 0 to 4" }, { status: 400 });

  const trial = await judgeDaily(session.userId, toId(id), choice);
  if (!trial) return Response.json({ error: "This trial was not found or was already answered." }, { status: 409 });
  return Response.json(trial);
}
