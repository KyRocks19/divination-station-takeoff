import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { removeCircleComputer } from "@/lib/circles";
import { circleFailure } from "@/lib/circles-http";

// The circle's owner removes one of the circle's picture computers. It stops working at once; when it was the last one, the circle's waiting
// pictures are given up with a plain sentence.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; tokenId: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const { id: rawId, tokenId: rawToken } = await params;
  const id = idParam(rawId);
  const tokenId = idParam(rawToken);
  if (!id || !tokenId) return Response.json({ error: "Not found" }, { status: 404 });
  return circleFailure(await removeCircleComputer(who.userId, id, tokenId)) ?? new Response(null, { status: 204 });
}
