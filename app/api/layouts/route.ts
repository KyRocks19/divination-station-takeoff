import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanLayoutInput, createLayout, listLayouts, loadLayout } from "@/lib/layouts";

// The person's layouts, each with its positions.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listLayouts(session.userId));
}

// Makes a layout: a name and an ordered list of named positions, each with an optional question of the person's own.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = cleanLayoutInput(await request.json().catch(() => null));
  if (typeof input === "string") return Response.json({ error: input }, { status: 400 });

  const id = await createLayout(session.userId, input);
  return Response.json(await loadLayout(session.userId, id), { status: 201 });
}
