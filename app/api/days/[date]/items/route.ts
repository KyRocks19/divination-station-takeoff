import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { addItem } from "@/lib/days";
import { isItemKind, isItemMode } from "@/lib/days-core";

// Keeps one of the person's own things with a day.
// Body: { kind: "reading" | "companion_note", ref_id, mode: "snapshot" | "link", link_back?: boolean (default true) }.
export async function POST(request: NextRequest, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isItemKind(body?.kind)) return Response.json({ error: "kind is not one I know." }, { status: 400 });
  if (!isItemMode(body?.mode)) return Response.json({ error: "mode must be snapshot or link." }, { status: 400 });
  const refId = toId(body?.ref_id);
  if (!refId) return Response.json({ error: "ref_id is not valid." }, { status: 400 });
  const result = await addItem(session.userId, date, body.kind, refId, body.mode, body.link_back !== false);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.id }, { status: 201 });
}
