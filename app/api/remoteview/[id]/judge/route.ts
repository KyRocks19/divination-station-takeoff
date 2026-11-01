import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { cleanChoice, judgeTrial, loadTrial } from "@/lib/remoteview";
import { idParam } from "@/lib/own-http";

// Records which of the four options the sealed impression matches best. Body: { choice: 0 to 3 }. It can be done once, and only after the impression is
// sealed. Only then does the trial show which option was the target.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const choice = cleanChoice(body?.choice);
  if (choice === null) return Response.json({ error: "choice must be a whole number from 0 to 3" }, { status: 400 });

  if (!(await judgeTrial(session.userId, toId(id), choice))) {
    return Response.json({ error: "This trial was not found, has no sealed impression yet, or was already judged." }, { status: 409 });
  }
  return Response.json(await loadTrial(session.userId, toId(id)));
}
