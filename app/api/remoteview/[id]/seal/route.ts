import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { MAX_IMPRESSION_CHARS, IDEOGRAM_FORM, cleanImpression, loadTrial, sealImpression } from "@/lib/remoteview";
import { cleanDrawing } from "@/lib/oracle-art";
import { idParam } from "@/lib/own-http";

// Seals the person's first impression and, if they made one, the quick drawing (the ideogram). Body: { impression, ideogram? }. It can be done once and never
// changed afterwards. Only then are the four options shown.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const impression = cleanImpression(body?.impression);
  if (impression === null) return Response.json({ error: `Write your impression, up to ${MAX_IMPRESSION_CHARS} characters.` }, { status: 400 });

  let ideogram = null;
  if (body?.ideogram !== undefined && body?.ideogram !== null) {
    const checked = cleanDrawing(body.ideogram, IDEOGRAM_FORM);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
    ideogram = checked.drawing;
  }

  if (!(await sealImpression(session.userId, toId(id), impression, ideogram))) {
    return Response.json({ error: "This trial was not found, or its impression is already sealed." }, { status: 409 });
  }
  return Response.json(await loadTrial(session.userId, toId(id)));
}
