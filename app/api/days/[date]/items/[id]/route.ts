import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { removeItem } from "@/lib/days";

// Takes one thing off a day. The original it came from is never touched.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ date: string; id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const itemId = toId(id);
  if (!itemId || !(await removeItem(session.userId, itemId))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
