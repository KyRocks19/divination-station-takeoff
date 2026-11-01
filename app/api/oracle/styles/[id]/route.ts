import { NextRequest } from "next/server";
import { idParam, requireUser } from "@/lib/own-http";
import { deleteStyle } from "@/lib/art-styles";

// Removes one of the signed-in person's saved styles. Pictures already made are not affected.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id || !(await deleteStyle(who.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
