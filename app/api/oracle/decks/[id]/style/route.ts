import { NextRequest } from "next/server";
import { bodyOf, idParam, requireUser } from "@/lib/own-http";
import { MAX_STYLE_LENGTH } from "@/lib/art-maker";
import { cleanStyleText } from "@/lib/art-styles-core";
import { setDeckStyle } from "@/lib/art-styles";

// Saves the picture-maker's style note for one of the signed-in person's sets (an empty note clears it), so the next picture for any item in the set starts from it.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await bodyOf(request)) as { style?: unknown } | null;
  const style = cleanStyleText(body?.style);
  if (style === undefined) return Response.json({ error: `A style note can be ${MAX_STYLE_LENGTH} characters at most.` }, { status: 400 });
  const result = await setDeckStyle(who.userId, id, style);
  if (result === "none") return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true, style });
}
